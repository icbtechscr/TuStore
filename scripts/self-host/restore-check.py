#!/usr/bin/env python3
"""Restore only into a disposable, network-isolated container. Never production."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
import uuid
from pathlib import Path

ROOT = Path("/var/backups/icb").resolve()
archive = Path(sys.argv[1]).resolve()
if archive.parent != ROOT or not re.fullmatch(r"icb-\d{8}T\d{6}Z\.tar\.gz", archive.name):
    raise SystemExit("Use an ICB backup in /var/backups/icb")
os.umask(0o077)
name = "icb-restore-check-" + uuid.uuid4().hex[:12]
work = ROOT / name
work.mkdir(mode=0o700)


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def digest(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        result.update(chunk)
    return result.hexdigest()


def sql(query, database="postgres"):
    return subprocess.check_output(["docker", "exec", name, "psql", "-X", "-q", "-h", "/tmp", "-p", "5544", "-U", "supabase_admin", "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", "SET timezone='UTC'", "-c", "SET extra_float_digits=3", "-c", query], text=True).strip()


started = False
success = False
try:
    expected_archive = archive.with_suffix(archive.suffix + ".sha256").read_text().split()[0]
    with archive.open("rb") as stream:
        if digest(stream) != expected_archive:
            raise RuntimeError("Backup checksum mismatch")
    with tarfile.open(archive) as source:
        source.extractall(work, filter="data")
    manifest = json.loads((work / "manifest.json").read_text())
    for filename, expected in manifest["files"].items():
        path = (work / filename).resolve()
        if path.parent != work:
            raise RuntimeError("Unexpected archive path")
        with path.open("rb") as stream:
            if digest(stream) != expected["sha256"]:
                raise RuntimeError(f"Checksum mismatch: {filename}")
    # Read every restored object, including MinIO metadata, and compare bytes.
    storage = work / "storage-restored"
    storage.mkdir()
    storage_files = 0
    with tarfile.open(work / "storage.tar.gz") as source:
        source.extractall(storage, filter="data")
        for member in source.getmembers():
            if member.isfile():
                with source.extractfile(member) as original, (storage / member.name).open("rb") as restored:
                    if digest(original) != digest(restored):
                        raise RuntimeError("Restored storage checksum mismatch")
                storage_files += 1
    data = work / "pgdata"
    data.mkdir(mode=0o700)
    os.chown(data, 100, 101)
    run(["docker", "run", "-d", "--name", name, "--label", "icb.restore-check=true", "--network", "none", "--memory", "768m", "--cpus", "1", "--user", "postgres", "--mount", f"type=bind,source={data},target=/restore", "--entrypoint", "sh", manifest["postgres_image"], "-c", "initdb -D /restore/pg -U supabase_admin -A trust >/restore/init.log && exec postgres -D /restore/pg -k /tmp -p 5544 -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements,pg_net,pg_cron -c cron.database_name=postgres -c cron.launch_active_jobs=off"], stdout=subprocess.DEVNULL)
    started = True
    for attempt in range(45):
        probe = subprocess.run(["docker", "exec", name, "pg_isready", "-h", "/tmp", "-p", "5544", "-U", "supabase_admin"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if probe.returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("Restore database did not start")
    roles = (work / "roles.sql").read_text()
    roles = re.sub(r"^CREATE ROLE supabase_admin;$", "-- bootstrap role already exists", roles, flags=re.M)
    run(["docker", "exec", "-i", name, "psql", "-X", "-h", "/tmp", "-p", "5544", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], input=roles, text=True, stdout=subprocess.DEVNULL)
    for database in manifest["databases"]:
        if not re.fullmatch(r"[A-Za-z0-9_]+", database):
            raise RuntimeError("Unexpected database name")
        if database != "postgres":
            sql(f'CREATE DATABASE "{database}"')
        with (work / f"{database}.dump").open("rb") as stream:
            run(["docker", "exec", "-i", name, "pg_restore", "-h", "/tmp", "-p", "5544", "-U", "supabase_admin", "-d", database, "--clean", "--if-exists", "--exit-on-error"], stdin=stream, stdout=subprocess.DEVNULL)
    expected = manifest["fingerprint"]
    for table, count in expected["tables"].items():
        if not re.fullmatch(r"[A-Za-z0-9_]+\.[A-Za-z0-9_]+", table):
            raise RuntimeError("Unexpected table name")
        schema, relation = table.split(".")
        actual = int(sql(f'SELECT count(*) FROM "{schema}"."{relation}"'))
        if actual != count:
            raise RuntimeError(f"Row count mismatch for {table}: {actual} != {count}")
        if table in expected.get("table_hashes", {}):
            if expected.get("hash_format") != "utc-float3-binary-v1":
                raise RuntimeError("Legacy content hashes depend on database locale; create a fresh backup with the current script")
            actual_hash = sql(f'''SELECT md5(coalesce(string_agg(row_to_json(o)::text, '' order by row_to_json(o)::text COLLATE "C"),'')) FROM "{schema}"."{relation}" o''')
            if actual_hash != expected["table_hashes"][table]:
                raise RuntimeError(f"Restored content mismatch for {table}")
    checks = {
        "rls_policies": "select count(*) from pg_policies where schemaname='public'",
        "password_users": "select count(*) from auth.users where encrypted_password <> ''",
        "storage_digest": "select md5(coalesce(string_agg(row_to_json(o)::text, '' order by id),'')) from storage.objects o",
    }
    for key, query in checks.items():
        if str(sql(query)) != str(expected[key]):
            raise RuntimeError(f"Restore mismatch: {key}")
    success = True
    result = {"ok": True, "archive": archive.name, "tables_verified": len(expected["tables"]), "content_hashes_verified": len(expected.get("table_hashes", {})), "storage_files_verified": storage_files, "password_users": expected["password_users"], "rls_policies": expected["rls_policies"], "isolated_network": True}
    (ROOT / f"{archive.name}.restore-check.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
finally:
    if started:
        label = subprocess.check_output(["docker", "inspect", name, "--format", '{{index .Config.Labels "icb.restore-check"}}'], text=True).strip()
        if label == "true":
            subprocess.run(["docker", "rm", "-f", name], check=True, stdout=subprocess.DEVNULL)
    if success and work.parent == ROOT and re.fullmatch(r"icb-restore-check-[0-9a-f]{12}", work.name):
        shutil.rmtree(work)
