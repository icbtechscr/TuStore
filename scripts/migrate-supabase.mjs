// Migra un proyecto de Supabase a otro SIN Docker ni pg_dump: solo Node + `pg`.
// Corre en TU computadora (la base vieja solo acepta conexiones desde afuera).
//
//   node scripts/migrate-supabase.mjs --check     -> prueba las dos conexiones
//   node scripts/migrate-supabase.mjs --schema    -> genera migration/schema.sql
//   node scripts/migrate-supabase.mjs --apply     -> aplica el esquema en la nueva
//   node scripts/migrate-supabase.mjs --data      -> copia los datos (public)
//   node scripts/migrate-supabase.mjs --auth      -> copia usuarios (con contrasenas)
//   node scripts/migrate-supabase.mjs --all       -> schema + apply + data + auth
//
// Lee OLD_DB_URL y NEW_DB_URL de .env.local. Nunca imprime las credenciales.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";

function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    console.warn("No se encontro .env.local");
  }
}
loadEnv();

const OLD_URL = process.env.OLD_DB_URL || "";
const NEW_URL = process.env.NEW_DB_URL || "";
const OUT_DIR = new URL("../migration/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCHEMA_FILE = OUT_DIR + "schema.sql";

const arg = (name) => process.argv.includes(`--${name}`);
const ALL = arg("all");

// Esquemas internos de Supabase que NO se tocan (los crea el proyecto nuevo).
const SKIP_SCHEMAS = [
  "pg_catalog", "information_schema", "pg_toast", "auth", "storage", "realtime",
  "supabase_functions", "supabase_migrations", "extensions", "graphql",
  "graphql_public", "net", "pgsodium", "pgsodium_masks", "vault", "cron", "pgbouncer",
];

function connect(url, label) {
  if (!url) throw new Error(`Falta ${label} en .env.local`);
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });
  return client;
}

const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';

// ---------------------------------------------------------------- check ----
async function check() {
  for (const [label, url] of [["VIEJA", OLD_URL], ["NUEVA", NEW_URL]]) {
    const c = connect(url, label === "VIEJA" ? "OLD_DB_URL" : "NEW_DB_URL");
    try {
      await c.connect();
      const v = await c.query("select current_database() db, version() v");
      const t = await c.query(
        "select count(*)::int n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
      );
      const u = await c.query("select count(*)::int n from auth.users");
      console.log(
        `OK ${label}: ${v.rows[0].db} | ${t.rows[0].n} tablas en public | ${u.rows[0].n} usuarios`
      );
    } catch (e) {
      console.error(`FALLO ${label}: ${e.message}`);
      throw e;
    } finally {
      await c.end().catch(() => {});
    }
  }
}

// --------------------------------------------------------------- schema ----
async function dumpSchema() {
  const c = connect(OLD_URL, "OLD_DB_URL");
  await c.connect();
  const parts = [];
  const add = (s) => parts.push(s);

  add("-- Esquema exportado del proyecto viejo. Generado por scripts/migrate-supabase.mjs");
  add("-- No incluye los esquemas internos de Supabase (auth, storage, etc.).");
  add("");

  // 1) Tipos enum
  const enums = await c.query(`
    select t.typname, array_agg(e.enumlabel order by e.enumsortorder) labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname order by t.typname`);
  for (const r of enums.rows) {
    const vals = r.labels.map((l) => `'${String(l).replace(/'/g, "''")}'`).join(", ");
    add(`create type public.${q(r.typname)} as enum (${vals});`);
  }
  if (enums.rows.length) add("");

  // 2) Tablas + columnas (format_type da el tipo exacto)
  const tables = await c.query(`
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'
    order by c.relname`);
  const tableNames = tables.rows.map((r) => r.relname);

  for (const t of tableNames) {
    const cols = await c.query(
      `select a.attname,
              format_type(a.atttypid, a.atttypmod) as type,
              a.attnotnull,
              pg_get_expr(d.adbin, d.adrelid) as def,
              a.attidentity
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = ('public.' || quote_ident($1))::regclass
         and a.attnum > 0 and not a.attisdropped
       order by a.attnum`,
      [t]
    );
    const lines = cols.rows.map((col) => {
      let s = `  ${q(col.attname)} ${col.type}`;
      if (col.attidentity === "a") s += " generated always as identity";
      else if (col.attidentity === "d") s += " generated by default as identity";
      else if (col.def) s += ` default ${col.def}`;
      if (col.attnotnull) s += " not null";
      return s;
    });
    add(`create table if not exists public.${q(t)} (\n${lines.join(",\n")}\n);`);
  }
  add("");

  // 3) Constraints: primero PK/UNIQUE, despues FK y CHECK
  for (const pass of [["p", "u"], ["f", "c"]]) {
    for (const t of tableNames) {
      const cons = await c.query(
        `select con.conname, pg_get_constraintdef(con.oid) as def
         from pg_constraint con
         where con.conrelid = ('public.' || quote_ident($1))::regclass
           and con.contype = any($2)
         order by con.conname`,
        [t, pass]
      );
      for (const r of cons.rows) {
        add(
          `alter table public.${q(t)} add constraint ${q(r.conname)} ${r.def};`
        );
      }
    }
  }
  add("");

  // 4) Indices que no respaldan constraints
  const idx = await c.query(`
    select i.indexname, i.indexdef
    from pg_indexes i
    where i.schemaname='public'
      and not exists (
        select 1 from pg_constraint con
        where con.conname = i.indexname
          and con.connamespace = 'public'::regnamespace
      )
    order by i.indexname`);
  for (const r of idx.rows) add(`${r.indexdef};`);
  if (idx.rows.length) add("");

  // 5) Funciones
  const fns = await c.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p')
    order by p.proname`);
  for (const r of fns.rows) add(`${r.def};\n`);

  // 6) Triggers
  const trg = await c.query(`
    select pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg
    join pg_class cl on cl.oid = tg.tgrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname='public' and not tg.tgisinternal
    order by tg.tgname`);
  for (const r of trg.rows) add(`${r.def};`);
  if (trg.rows.length) add("");

  // 7) RLS: habilitar y recrear politicas
  const rls = await c.query(`
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
    order by c.relname`);
  for (const r of rls.rows) {
    add(`alter table public.${q(r.relname)} enable row level security;`);
  }
  const pol = await c.query(`
    select tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname='public'
    order by tablename, policyname`);
  for (const p of pol.rows) {
    const roles = (p.roles || []).filter(Boolean).join(", ") || "public";
    let s = `create policy ${q(p.policyname)} on public.${q(p.tablename)}`;
    s += ` as ${p.permissive === "PERMISSIVE" ? "permissive" : "restrictive"}`;
    s += ` for ${String(p.cmd || "ALL").toLowerCase()}`;
    s += ` to ${roles}`;
    if (p.qual) s += ` using (${p.qual})`;
    if (p.with_check) s += ` with check (${p.with_check})`;
    add(`${s};`);
  }

  // 8) Permisos que Supabase espera para la API
  add("");
  add("grant usage on schema public to anon, authenticated, service_role;");
  add("grant all on all tables in schema public to anon, authenticated, service_role;");
  add("grant all on all sequences in schema public to anon, authenticated, service_role;");
  add("grant all on all functions in schema public to anon, authenticated, service_role;");

  await c.end();

  mkdirSync(dirname(SCHEMA_FILE), { recursive: true });
  writeFileSync(SCHEMA_FILE, parts.join("\n") + "\n", "utf8");
  console.log(
    `Esquema escrito en migration/schema.sql (${tableNames.length} tablas, ${fns.rows.length} funciones, ${pol.rows.length} politicas)`
  );
}

// ---------------------------------------------------------------- apply ----
async function applySchema() {
  const sql = readFileSync(SCHEMA_FILE, "utf8");
  const c = connect(NEW_URL, "NEW_DB_URL");
  await c.connect();
  // Sentencia por sentencia: si una falla, se avisa y se sigue (los "already
  // exists" son esperables al reintentar).
  const stmts = splitSql(sql);
  let ok = 0;
  const fails = [];
  for (const s of stmts) {
    try {
      await c.query(s);
      ok++;
    } catch (e) {
      fails.push(`${e.message}\n   > ${s.slice(0, 120).replace(/\s+/g, " ")}`);
    }
  }
  await c.end();
  console.log(`Esquema aplicado: ${ok}/${stmts.length} sentencias OK`);
  if (fails.length) {
    console.log(`\n${fails.length} con error:`);
    for (const f of fails.slice(0, 40)) console.log(" - " + f);
  }
}

/** Divide por ';' respetando comillas y cuerpos $$ ... $$ de las funciones. */
function splitSql(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  let dollar = null;
  let quote = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        buf += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
    } else if (quote) {
      if (ch === quote) quote = null;
    } else {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) {
        dollar = m[0];
        buf += dollar;
        i += dollar.length;
        continue;
      }
      if (ch === "'" || ch === '"') quote = ch;
      else if (ch === "-" && sql[i + 1] === "-") {
        const nl = sql.indexOf("\n", i);
        i = nl === -1 ? sql.length : nl + 1;
        continue;
      } else if (ch === ";") {
        const s = buf.trim();
        if (s) out.push(s);
        buf = "";
        i++;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

// ----------------------------------------------------------------- data ----
/** Ordena las tablas para respetar las llaves foraneas. */
async function tableOrder(c) {
  const t = await c.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname`);
  const names = t.rows.map((r) => r.relname);
  const deps = new Map(names.map((n) => [n, new Set()]));
  const fk = await c.query(`
    select cl.relname as child, rf.relname as parent
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_class rf on rf.oid = con.confrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where con.contype='f' and n.nspname='public'`);
  for (const r of fk.rows) {
    if (r.child !== r.parent && deps.has(r.child) && deps.has(r.parent)) {
      deps.get(r.child).add(r.parent);
    }
  }
  const out = [];
  const seen = new Set();
  const visit = (n, stack = new Set()) => {
    if (seen.has(n) || stack.has(n)) return;
    stack.add(n);
    for (const d of deps.get(n) || []) visit(d, stack);
    stack.delete(n);
    seen.add(n);
    out.push(n);
  };
  for (const n of names) visit(n);
  return out;
}

async function copyData() {
  const src = connect(OLD_URL, "OLD_DB_URL");
  const dst = connect(NEW_URL, "NEW_DB_URL");
  await src.connect();
  await dst.connect();

  const order = await tableOrder(src);
  const BATCH = 500;
  for (const t of order) {
    const cols = await src.query(
      `select a.attname from pg_attribute a
       where a.attrelid = ('public.' || quote_ident($1))::regclass
         and a.attnum > 0 and not a.attisdropped
         and a.attgenerated = ''
       order by a.attnum`,
      [t]
    );
    const names = cols.rows.map((r) => r.attname);
    if (!names.length) continue;

    const total = (await src.query(`select count(*)::int n from public.${q(t)}`)).rows[0].n;
    if (!total) {
      console.log(`${t}: 0`);
      continue;
    }

    let copied = 0;
    for (let off = 0; off < total; off += BATCH) {
      const rows = (
        await src.query(
          `select ${names.map(q).join(", ")} from public.${q(t)} limit $1 offset $2`,
          [BATCH, off]
        )
      ).rows;
      if (!rows.length) break;

      const params = [];
      const tuples = rows.map((row) => {
        const ph = names.map((n) => {
          params.push(row[n]);
          return `$${params.length}`;
        });
        return `(${ph.join(",")})`;
      });
      await dst.query(
        `insert into public.${q(t)} (${names.map(q).join(", ")}) values ${tuples.join(
          ","
        )} on conflict do nothing`,
        params
      );
      copied += rows.length;
    }
    console.log(`${t}: ${copied}/${total}`);
  }

  // Deja las secuencias donde corresponde.
  await dst.query(`
    do $$
    declare r record; mx bigint;
    begin
      for r in
        select s.relname as seq, t.relname as tbl, a.attname as col
        from pg_class s
        join pg_depend d on d.objid = s.oid and d.deptype = 'a'
        join pg_class t on t.oid = d.refobjid
        join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
        join pg_namespace n on n.oid = s.relnamespace
        where s.relkind = 'S' and n.nspname = 'public'
      loop
        execute format('select coalesce(max(%I),0) from public.%I', r.col, r.tbl) into mx;
        execute format('select setval(%L, greatest(%s,1))', 'public.' || r.seq, mx);
      end loop;
    end $$;`);

  await src.end();
  await dst.end();
  console.log("Datos copiados.");
}

// ----------------------------------------------------------------- auth ----
// Copia auth.users y auth.identities TAL CUAL, incluido encrypted_password:
// asi cada colaborador conserva su contrasena actual.
async function copyAuth() {
  const src = connect(OLD_URL, "OLD_DB_URL");
  const dst = connect(NEW_URL, "NEW_DB_URL");
  await src.connect();
  await dst.connect();

  for (const table of ["users", "identities"]) {
    const colsSrc = await src.query(
      `select a.attname from pg_attribute a
       where a.attrelid = ('auth.' || quote_ident($1))::regclass
         and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''`,
      [table]
    );
    const colsDst = await dst.query(
      `select a.attname from pg_attribute a
       where a.attrelid = ('auth.' || quote_ident($1))::regclass
         and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''`,
      [table]
    );
    const dstSet = new Set(colsDst.rows.map((r) => r.attname));
    const names = colsSrc.rows.map((r) => r.attname).filter((n) => dstSet.has(n));
    if (!names.length) continue;

    const rows = (
      await src.query(`select ${names.map(q).join(", ")} from auth.${q(table)}`)
    ).rows;
    let n = 0;
    for (const row of rows) {
      const params = names.map((c) => row[c]);
      const ph = names.map((_, i) => `$${i + 1}`);
      try {
        await dst.query(
          `insert into auth.${q(table)} (${names.map(q).join(", ")})
           values (${ph.join(",")}) on conflict do nothing`,
          params
        );
        n++;
      } catch (e) {
        console.warn(`  auth.${table}: fila omitida (${e.message})`);
      }
    }
    console.log(`auth.${table}: ${n}/${rows.length}`);
  }

  await src.end();
  await dst.end();
  console.log("Usuarios copiados (conservan su contrasena).");
}

// ----------------------------------------------------------------- main ----
try {
  if (arg("check")) await check();
  if (ALL || arg("schema")) await dumpSchema();
  if (ALL || arg("apply")) await applySchema();
  if (ALL || arg("data")) await copyData();
  if (ALL || arg("auth")) await copyAuth();
  if (!process.argv.slice(2).length) {
    console.log("Usa --check | --schema | --apply | --data | --auth | --all");
  }
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
