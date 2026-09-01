import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Información de envíos",
  description:
    "Información para coordinar entregas y envíos de TUStore Costa Rica.",
  alternates: { canonical: absoluteUrl("/envios") },
};

export default function EnviosPage() {
  return (
    <LegalPage
      title="Información de envíos"
      intro="TUStore realiza envíos a todo Costa Rica. Antes de cobrar, un asesor confirma con cada cliente el transportista, costo y plazo aplicables a su pedido."
      updated="Agosto 2026"
    >
      <LegalSection heading="1. Cobertura">
        <p>
          Coordinamos entregas en la Gran Área Metropolitana y envíos al resto
          del país. La modalidad disponible depende del destino, el tamaño del
          paquete y las características del producto.
        </p>
      </LegalSection>

      <LegalSection heading="2. Costo del envío">
        <p>
          El costo se cotiza individualmente según destino, peso, dimensiones y
          proveedor de transporte. El asesor comunica el monto antes de que el
          cliente confirme la compra; el sitio no promete una tarifa fija ni
          envío gratuito.
        </p>
      </LegalSection>

      <LegalSection heading="3. Plazo y disponibilidad">
        <p>
          El plazo se confirma después de verificar existencias y disponibilidad
          del transportista. Feriados, alta demanda, condiciones climáticas o
          situaciones fuera del control de TUStore pueden modificar la fecha
          estimada.
        </p>
      </LegalSection>

      <LegalSection heading="4. Datos para la entrega">
        <p>
          Para preparar la cotización necesitamos nombre, teléfono, provincia,
          cantón, distrito, dirección exacta y una referencia. El cliente debe
          revisar que estos datos sean correctos antes del despacho.
        </p>
      </LegalSection>

      <LegalSection heading="5. Confirmación con un asesor">
        <p>
          Para conocer la opción exacta de entrega, escribinos al WhatsApp
          <a className="font-semibold text-accent-300 hover:underline" href="https://wa.me/50640025649">
            {" "}+506 4002 5649
          </a>
          . El pedido se despacha únicamente después de confirmar disponibilidad,
          condiciones de pago y datos de entrega.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
