// API handlers depend on runtime services (Supabase, email, payments, etc.).
// Keep the whole API subtree out of the build-time static data collection so
// a fresh self-hosted install can build before its private integrations exist.
export const dynamic = "force-dynamic";

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
