#!/usr/bin/env python3
"""Consistent logical DB + Storage + configuration backup, private by default.

Never copies a running PGDATA directory. Retries if Storage metadata changes
during the snapshot. Archives contain secrets: keep them private/off-server.
"""
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/var/backups/icb")
SERVICE = "9tcnty7pzjn5zijjlnkukpcl"
APP = "e3qib0s0vmfx7ex10uzea2dh"
DB = f"supabase-db-{SERVICE}"
SERVICE_DIR = Path(f"/data/coolify/services/{SERVICE}")


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def sql(query, database="postgres"):
    return subprocess.check_output([
        "docker", "exec", DB, "psql", "-X", "-q", "-U", "supabase_admin",
        "-d", database, "-At", "-v", "ON_ERROR_STOP=1",
        "-c", "SET timezone='UTC'", "-c", "SET extra_float_digits=3", "-c", query,
    ], text=True).strip()


def storage_digest():
    return sql("select md5(coalesce(string_agg(row_to_json(o)::text, '' order by id),'')) from storage.objects o")


def fingerprint():
    names = sql("select schemaname || '.' || tablename from pg_tables where schemaname in ('public','auth','storage') order by 1").splitlines()
    tables = {}
    hashes = {}
    for name in names:
        if not re.fullmatch(r"[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+", name):
            raise RuntimeError("Unexpected table name")
        schema, table = name.split(".")
        tables[name] = int(sql(f'SELECT count(*) FROM "{schema}"."{table}"'))
        # Binary ordering is identical with ICU/libc, regardless of database locale.
        hashes[name] = sql(f'''SELECT md5(coalesce(string_agg(row_to_json(o)::text, '' order by row_to_json(o)::text COLLATE "C"),'')) FROM "{schema}"."{table}" o''')
    return {
        "hash_format": "utc-float3-binary-v1",
        "tables": tables,
        "table_hashes": hashes,
        "rls_policies": int(sql("select count(*) from pg_policies where schemaname='public'")),
        "password_users": int(sql("select count(*) from auth.users where encrypted_password <> ''")),
        "storage_digest": storage_digest(),
    }


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dump(args, output):
    with output.open("wb") as stream:
        run(args, stdout=stream, stderr=subprocess.PIPE)
    os.chmod(output, 0o600)


def main():
    os.umask(0o077)
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = open("/run/lock/icb-backup.lock", "w")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    work = ROOT / f"{stamp}.partial"
    work.mkdir(mode=0o700)
    databases = sql("select datname from pg_database where not datistemplate order by 1").splitlines()
    for database in databases:
        if not re.fullmatch(r"[A-Za-z0-9_]+", database):
            raise RuntimeError("Unexpected database name")
    for attempt in range(3):
        before = fingerprint()
        for database in databases:
            dump(["docker", "exec", DB, "pg_dump", "-U", "supabase_admin", "-Fc", database], work / f"{database}.dump")
        dump(["tar", "-czf", "-", "-C", str(SERVICE_DIR / "volumes/storage"), "."], work / "storage.tar.gz")
        after = fingerprint()
        if before == after:
            break
    else:
        raise RuntimeError("Database or Storage changed during every snapshot; backup not published")
    dump(["docker", "exec", DB, "pg_dumpall", "-U", "supabase_admin", "--globals-only"], work / "roles.sql")
    dump(["docker", "exec", "coolify-db", "pg_dump", "-U", "coolify", "-Fc", "coolify"], work / "coolify.dump")
    sources = [
        str(SERVICE_DIR).lstrip("/"), f"data/coolify/applications/{APP}",
        "data/coolify/source/.env", "data/coolify/ssh", "etc/icb", "opt/icb-ops",
    ]
    sources = [p for p in sources if Path("/", p).exists()]
    dump(["tar", "-czf", "-", "--exclude=" + str(SERVICE_DIR / "volumes/storage").lstrip("/"), "-C", "/", *sources], work / "config.tar.gz")
    manifest = {
        "created_at": stamp,
        "database_container": DB,
        "postgres_image": subprocess.check_output(["docker", "inspect", DB, "--format", "{{.Config.Image}}"], text=True).strip(),
        "databases": databases,
        "fingerprint": after,
        "files": {p.name: {"sha256": sha(p), "bytes": p.stat().st_size} for p in sorted(work.iterdir())},
    }
    (work / "manifest.json").write_text(json.dumps(manifest, indent=2))
    archive = ROOT / f"icb-{stamp}.tar.gz"
    temporary = archive.with_suffix(".partial")
    with tarfile.open(temporary, "w:gz", compresslevel=1) as out:
        for path in sorted(work.iterdir()):
            out.add(path, arcname=path.name)
    temporary.rename(archive)
    checksum = sha(archive)
    archive.with_suffix(archive.suffix + ".sha256").write_text(f"{checksum}  {archive.name}\n")
    # Only this run's generated scratch directory may be removed.
    if work.parent == ROOT and re.fullmatch(r"\d{8}T\d{6}Z\.partial", work.name):
        shutil.rmtree(work)
    # Keep the latest 14 completed backups; never remove unrelated files.
    completed = sorted(p for p in ROOT.glob("icb-*.tar.gz") if re.fullmatch(r"icb-\d{8}T\d{6}Z\.tar\.gz", p.name))
    for old in completed[:-14]:
        old.unlink()
        old.with_suffix(old.suffix + ".sha256").unlink(missing_ok=True)
    print(json.dumps({"archive": str(archive), "bytes": archive.stat().st_size, "sha256": checksum, "databases": databases}))


if __name__ == "__main__":
    main()
