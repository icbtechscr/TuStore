import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Términos y condiciones de uso y compra en el sitio de TUStore Costa Rica.",
  alternates: { canonical: absoluteUrl("/terminos") },
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      intro="Al usar este sitio y realizar compras aceptás los siguientes términos y condiciones."
      updated="Agosto 2026"
    >
      <LegalSection heading="1. Aceptación">
        <p>
          El uso de este sitio implica la aceptación plena de estos términos.
          Si no estás de acuerdo, te pedimos no utilizar el sitio ni realizar
          compras.
        </p>
      </LegalSection>
      <LegalSection heading="2. Productos y precios">
        <p>
          Los precios se muestran en colones costarricenses (CRC) e incluyen
          los impuestos aplicables salvo indicación contraria. Las imágenes son
          de referencia. Nos reservamos el derecho de corregir errores de
          precio o disponibilidad antes de confirmar un pedido.
        </p>
      </LegalSection>
      <LegalSection heading="3. Pedidos">
        <p>
          El carrito genera una solicitud que se coordina por WhatsApp. Un pedido
          se considera confirmado cuando un asesor verifica existencias, entrega
          y pago. TUStore puede rechazar o cancelar solicitudes por falta de
          stock, errores de información o sospecha de fraude.
        </p>
      </LegalSection>
      <LegalSection heading="4. Disponibilidad de stock">
        <p>
          El stock se actualiza de forma periódica. En caso de que un producto
          comprado no esté disponible, te contactaremos para ofrecer una
          alternativa o el reembolso total.
        </p>
      </LegalSection>
      <LegalSection heading="5. Propiedad intelectual">
        <p>
          Las marcas, logotipos y contenidos del sitio pertenecen a TUStore
          o a sus respectivos titulares. No se permite su uso sin
          autorización.
        </p>
      </LegalSection>
      <LegalSection heading="6. Modificaciones">
        <p>
          Podemos actualizar estos términos en cualquier momento. La versión
          vigente es la publicada en esta página.
        </p>
      </LegalSection>
      <LegalSection heading="7. Legislación aplicable">
        <p>
          Estos términos se rigen por las leyes de la República de Costa Rica,
          incluida la Ley N.º 7472 de Promoción de la Competencia y Defensa
          Efectiva del Consumidor.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

