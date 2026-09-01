import { timingSafeEqual } from "node:crypto";

/** Sin secreto el cron queda cerrado; nunca aceptar secretos en la URL/logs. */
export function cronAuthorized(req: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
