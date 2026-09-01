import type { NextRequest } from "next/server";

/** Origen público real del request (https://tustorecr.com en prod). */
export function originFromRequest(req: NextRequest): string {
  const fromHeader = req.headers.get("origin");
  if (fromHeader) return fromHeader.replace(/\/$/, "");
  const host = req.headers.get("host");
  if (host) {
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "").replace(/\/$/, "");
}

