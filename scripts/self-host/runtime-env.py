#!/usr/bin/env python3
"""Convert a private JSON export to Docker's literal env-file format."""
import json
import os
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:3])
env = json.loads(source.read_text())
if any("\n" in v or "\r" in v or "\0" in v for v in env.values()):
    raise SystemExit("Multiline secrets are not supported by Docker env-file")
target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as out:
    out.write("".join(f"{k}={v}\n" for k, v in env.items()))
os.chmod(target, 0o600)
print(f"Configured {len(env)} runtime variables (values hidden)")
