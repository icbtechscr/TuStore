import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Garantía, cambios y devoluciones",
  description:
    "Cómo solicitar asistencia de garantía, cambio o devolución en TUStore Costa Rica.",
  alternates: { canonical: absoluteUrl("/devoluciones") },
};

export default function DevolucionesPage() {
  return (
    <LegalPage
      title="Garantía, cambios y devoluciones"
      intro="Las condiciones de garantía y cambio pueden variar según el producto y el fabricante. TUStore revisa cada solicitud con el comprobante de compra y confirma por escrito el procedimiento aplicable."
      updated="Agosto 2026"
    >
      <LegalSection heading="1. Información necesaria">
        <p>
          Tené a mano la factura o comprobante, el nombre del producto, número de
          serie cuando aplique, fecha de compra y una descripción clara del caso.
          Fotografías o videos pueden ayudar a realizar una primera evaluación.
        </p>
      </LegalSection>

      <LegalSection heading="2. Garantía">
        <p>
          La cobertura, vigencia y procedimiento dependen de las condiciones del
          fabricante y de la normativa aplicable. Antes de enviar o trasladar el
          equipo, contactá a TUStore para recibir instrucciones y evitar daños o
          costos innecesarios.
        </p>
      </LegalSection>

      <LegalSection heading="3. Revisión del producto">
        <p>
          Podemos solicitar una revisión física o técnica antes de determinar si
          corresponde reparación, sustitución u otra solución. Conservá el
          empaque, accesorios, manuales y sellos mientras se analiza el caso.
        </p>
      </LegalSection>

      <LegalSection heading="4. Cambios o devoluciones">
        <p>
          Las solicitudes comerciales se valoran según la condición del producto,
          su empaque, accesorios, comprobante y circunstancias de la compra. La
          recepción de una solicitud no implica aprobación automática y no limita
          los derechos reconocidos por la legislación costarricense.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contacto">
        <p>
          Escribí a
          <a className="font-semibold text-accent-300 hover:underline" href="mailto:info@tustorecr.com">
            {" "}info@tustorecr.com
          </a>
          {" "}o al WhatsApp
          <a className="font-semibold text-accent-300 hover:underline" href="https://wa.me/50640025649">
            {" "}+506 4002 5649
          </a>
          . Un asesor confirmará el siguiente paso y cualquier costo de traslado
          antes de recibir el producto.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
