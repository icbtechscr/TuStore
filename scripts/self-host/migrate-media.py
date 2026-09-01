#!/usr/bin/env python3
"""Repoint copied public product media on this specific staging DB only.
Requires matching local Storage objects and an explicit --apply.
"""
import json
import subprocess
import sys
from urllib.parse import urlsplit, unquote

DB = 'supabase-db-9tcnty7pzjn5zijjlnkukpcl'
SOURCE = 'https://fnnzlkvohsaxwnmdymvc.supabase.co'
TARGET = 'http://supabase-icb-pruebas.192.168.0.104.sslip.io'
PREFIX = '/storage/v1/object/public/'


def query(sql):
    return subprocess.check_output(['docker', 'exec', '-i', DB, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True).strip()


rows = json.loads(query('select coalesce(json_agg(x),\'[]\') from (select id,url from public.product_images) x;'))
objects = json.loads(query('select coalesce(json_agg(x),\'[]\') from (select bucket_id,name from storage.objects) x;'))
known = {(o['bucket_id'], o['name']) for o in objects}
updates = []
missing = 0
missing_urls = []
for row in rows:
    parsed = urlsplit(row['url'])
    if f'{parsed.scheme}://{parsed.netloc}' != SOURCE or not parsed.path.startswith(PREFIX):
        continue
    bucket, name = unquote(parsed.path[len(PREFIX):]).split('/', 1)
    if (bucket, name) not in known:
        missing += 1
        missing_urls.append(row['url'])
        continue
    updates.append((row['id'], row['url'], row['url'].replace(SOURCE, TARGET, 1)))
if missing:
    print(json.dumps({'missing_public_urls': missing_urls}))
    raise SystemExit(f'Aborted: {missing} public images do not exist in local Storage metadata')
if '--apply' in sys.argv and updates:
    def literal(value):
        return "'" + str(value).replace("'", "''") + "'"
    values = ','.join('(' + ','.join(map(literal, row)) + ')' for row in updates)
    query('BEGIN; WITH incoming(id,old_url,new_url) AS (VALUES ' + values + ') UPDATE public.product_images p SET url=i.new_url FROM incoming i WHERE p.id::text=i.id AND p.url=i.old_url; COMMIT;')
print(json.dumps({'matched_local_objects': len(updates), 'missing': missing, 'applied': '--apply' in sys.argv}))
