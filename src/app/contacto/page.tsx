import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { getSiteContent } from "@/lib/site-content";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contactá a TUStore Costa Rica por teléfono, WhatsApp, correo o en nuestra tienda de Barreal de Heredia.",
  alternates: { canonical: absoluteUrl("/contacto") },
};

// Cache de 60 min: cada visita ya no golpea la base (baja el egress).
export const revalidate = 3600;

export default async function ContactoPage() {
  const { footer } = await getSiteContent();
  const telHref = `tel:${footer.phone.replace(/[^+\d]/g, "")}`;

  return (
    <LegalPage
      title="Contacto"
      intro="Estamos para ayudarte. Escribinos o llamanos y un asesor te atenderá."
    >
      <LegalSection heading="Teléfono">
        <p className="flex items-center gap-2">
          <Phone className="size-4 text-accent-300" />
          <a href={telHref} className="hover:text-accent-300">
            {footer.phone}
          </a>
        </p>
      </LegalSection>
      <LegalSection heading="Correo">
        <p className="flex items-center gap-2">
          <Mail className="size-4 text-accent-300" />
          <a
            href={`mailto:${footer.email}`}
            className="hover:text-accent-300"
          >
            {footer.email}
          </a>
        </p>
      </LegalSection>
      <LegalSection heading="Ubicación">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-accent-300" />
          {footer.locationsText}
        </p>
      </LegalSection>
    </LegalPage>
  );
}

