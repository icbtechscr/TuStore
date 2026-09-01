import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { getSiteContent } from "@/lib/site-content";
import { BRANCHES } from "@/lib/branches";

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-3h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 3h-2.2v7A10 10 0 0 0 22 12z" />
  </svg>
);
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M23 7.2s-.2-1.6-.9-2.3c-.8-.9-1.8-.9-2.2-1C16.7 3.5 12 3.5 12 3.5s-4.7 0-7.9.4c-.4.1-1.4.1-2.2 1-.7.7-.9 2.3-.9 2.3S.8 9 .8 10.9v1.8C.8 14.5 1 16.3 1 16.3s.2 1.6.9 2.3c.8.9 1.9.9 2.4 1 1.7.2 7.7.3 7.7.3s4.7 0 7.9-.4c.4-.1 1.4-.1 2.2-1 .7-.7.9-2.3.9-2.3s.2-1.8.2-3.7v-1.8c0-1.9-.2-3.7-.2-3.7zM9.7 14.6V8.2l6.1 3.2-6.1 3.2z" />
  </svg>
);

export async function Footer() {
  const { footer } = await getSiteContent();
  const telHref = `tel:${footer.phone.replace(/[^+\d]/g, "")}`;
  return (
    <footer className="mt-20 bg-gradient-to-br from-brand-800 via-brand-900 to-ink-900 text-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Image
              src="/tustore-logo.png"
              alt="TUStore Costa Rica"
              width={263}
              height={64}
              style={{ width: "auto" }}
              className="h-16 w-auto object-contain brightness-0 invert"
            />
            <p className="mt-4 max-w-sm text-sm text-ink-400">
              {footer.description}
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-accent-500" aria-hidden />
                <a href={telHref} className="hover:text-white">
                  {footer.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-accent-500" aria-hidden />
                <a href={`mailto:${footer.email}`} className="hover:text-white">
                  {footer.email}
                </a>
              </li>
            </ul>
            <div className="mt-6 flex gap-3">
              {[
                { Icon: FacebookIcon, href: footer.facebook, label: "Facebook" },
                { Icon: InstagramIcon, href: footer.instagram, label: "Instagram" },
                { Icon: YoutubeIcon, href: footer.youtube, label: "YouTube" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-accent-500 hover:text-ink-900"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {footer.columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-sm">
                {col.items.map((it, i) => (
                  <li key={i}>
                    <Link href={it.href} className="transition-colors hover:text-accent-500">
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              Nuestra tienda
            </h4>
            <Link
              href="/sucursales"
              className="text-xs font-semibold text-accent-500 hover:text-accent-400"
            >
              Ver ubicación y horario →
            </Link>
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRANCHES.map((b) => {
              const tel = `tel:${b.phone.replace(/[^+\d]/g, "")}`;
              return (
                <li key={b.id} className="flex items-start gap-2.5">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-accent-500"
                    aria-hidden
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {b.city}
                      {b.cedi && (
                        <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                          CEDI
                        </span>
                      )}
                    </div>
                    <a
                      href={tel}
                      className="mt-0.5 inline-flex items-center gap-1.5 text-sm hover:text-white"
                    >
                      <Phone className="size-3.5 text-accent-500" aria-hidden />
                      {b.phone}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-5 text-xs text-ink-500">
          <p>© {new Date().getFullYear()} TUStore Costa Rica. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
