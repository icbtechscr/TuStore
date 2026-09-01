import { decodeHtml } from "./utils";

export type KitDescription = {
  header: string[];
  rows: string[][];
};

export function parseKitDescription(text: string): KitDescription | null {
  if (!text) return null;

  const normalized = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  const decoded = decodeHtml(normalized).replace(/\r/g, "").trim();

  const blocks = decoded
    .split(/\n\s*\n+/)
    .map((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    )
    .filter((b) => b.length > 0);

  if (blocks.length < 2) return null;

  const header = blocks[0];
  if (header.length < 2 || header.length > 6) return null;

  const cols = header.length;
  const rows = blocks.slice(1).filter((b) => b.length === cols);
  if (rows.length === 0) return null;

  return { header, rows };
}
