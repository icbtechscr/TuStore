import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteMediaUrl } from "../../src/lib/image-url.ts";
import { cronAuthorized } from "../../src/lib/cron-auth.ts";
import { syncRange, checkSyncTarget } from "./run-cpi.mjs";

const old = "https://fnnzlkvohsaxwnmdymvc.supabase.co";
const local = "http://supabase-icb-pruebas.192.168.0.104.sslip.io";
test("public storage moves with the environment without losing path/query", () => {
  assert.equal(rewriteMediaUrl(`${old}/storage/v1/object/public/imagenes/a%20b.png?v=2`, local), `${local}/storage/v1/object/public/imagenes/a%20b.png?v=2`);
  assert.equal(rewriteMediaUrl(`${local}/storage/v1/object/public/media/avatar.png`, "https://api.icbtechscr.com"), "https://api.icbtechscr.com/storage/v1/object/public/media/avatar.png");
  assert.equal(rewriteMediaUrl(`${old}/storage/v1/object/public/imagenes/a.png`, old), `${old}/storage/v1/object/public/imagenes/a.png`);
});
test("signed links, third parties, relative paths and invalid URLs stay unchanged", () => {
  for (const src of [`${old}/storage/v1/object/sign/private/a?token=abc`, "https://other.supabase.co/storage/v1/object/public/media/a", "/logo.png", "bad-url", `${old}.evil.test/storage/v1/object/public/media/a`]) {
    assert.equal(rewriteMediaUrl(src, local), src);
  }
  assert.equal(rewriteMediaUrl(null, local), "");
  assert.equal(rewriteMediaUrl("  /logo.png  ", local), "/logo.png");
});
test("cron fails closed and only accepts the authorization header", () => {
  const req = (headers = {}) => new Request("https://icb.test/api/cron?secret=test", { headers });
  assert.equal(cronAuthorized(req(), ""), false);
  assert.equal(cronAuthorized(req(), "test"), false);
  assert.equal(cronAuthorized(req({ authorization: "Bearer wrong" }), "test"), false);
  assert.equal(cronAuthorized(req({ authorization: "Bearer test" }), "test"), true);
});
test("worker uses Costa Rica day boundaries and can cross a month", () => {
  assert.deepEqual(syncRange(new Date("2026-09-01T03:00:00Z"), 3), { from: "2026-08-29", to: "2026-08-31" });
  assert.deepEqual(syncRange(new Date("2026-09-01T18:00:00Z"), 3), { from: "2026-08-30", to: "2026-09-01" });
  assert.throws(() => syncRange(new Date(), 63));
});
test("worker refuses cloud and a mismatched target", () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: local, ICB_SYNC_TARGET_ORIGIN: local, CPI_USER: "test", CPI_PASS: "test", CPI_ID: "20", SUPABASE_SECRET_KEY: "test" };
  assert.doesNotThrow(() => checkSyncTarget(env));
  assert.throws(() => checkSyncTarget({ ...env, NEXT_PUBLIC_SUPABASE_URL: old, ICB_SYNC_TARGET_ORIGIN: old }));
  assert.throws(() => checkSyncTarget({ ...env, ICB_SYNC_TARGET_ORIGIN: "https://another.test" }));
});
