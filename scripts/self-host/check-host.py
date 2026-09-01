#!/usr/bin/env python3
"""Read-only host configuration audit; no secret values in output."""
import json
import subprocess
from pathlib import Path


def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name], text=True))[0]


def env_of(container):
    return dict(item.split('=', 1) for item in container['Config']['Env'])


containers = subprocess.check_output(['docker', 'ps', '--filter', 'name=^e3qib0s0vmfx7ex10uzea2dh-', '--format', '{{.Names}}'], text=True).splitlines()
if len(containers) != 1:
    raise SystemExit('Expected one ICB application container')
app = inspect(containers[0])
runtime = env_of(app)
expected = json.loads(Path('/opt/icb-ops/runtime.json').read_text())
mismatches = [key for key, value in expected.items() if key != 'ICB_SYNC_TARGET_ORIGIN' and runtime.get(key) != value]
auth = env_of(inspect('supabase-auth-9tcnty7pzjn5zijjlnkukpcl'))
print(json.dumps({
    'container': containers[0],
    'health': app['State'].get('Health', {}).get('Status'),
    'runtime_mismatches': mismatches,
    'smtp_host': auth.get('GOTRUE_SMTP_HOST'),
    'smtp_user_present': bool(auth.get('GOTRUE_SMTP_USER')),
    'smtp_password_present': bool(auth.get('GOTRUE_SMTP_PASS')),
    'auth_site_url': auth.get('GOTRUE_SITE_URL'),
}, indent=2))
if mismatches:
    raise SystemExit(1)
