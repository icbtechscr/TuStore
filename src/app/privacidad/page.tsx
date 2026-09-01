import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo TUStore Costa Rica recopila, usa y protege los datos personales de sus clientes.",
  alternates: { canonical: absoluteUrl("/privacidad") },
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      intro="En TUStore Costa Rica protegemos tus datos personales conforme a la Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica."
      updated="Agosto 2026"
    >
      <LegalSection heading="1. Responsable del tratamiento">
        <p>
          TUStore Costa Rica es responsable del
          tratamiento de los datos personales recopilados a través de este
          sitio. Consultas: info@tustorecr.com.
        </p>
      </LegalSection>
      <LegalSection heading="2. Datos que recopilamos">
        <p>
          Recopilamos nombre, correo electrónico, número de teléfono, dirección
          de envío y datos de facturación cuando enviás una solicitud de compra
          o nos contactás. Este sitio no solicita ni almacena números completos
          de tarjeta; cualquier opción de pago se coordina directamente con un
          asesor.
        </p>
      </LegalSection>
      <LegalSection heading="3. Uso de los datos">
        <p>
          Usamos tus datos para procesar pedidos, coordinar envíos, brindar
          soporte, emitir facturas y, si lo autorizás, enviarte promociones.
          No vendemos ni alquilamos datos personales a terceros.
        </p>
      </LegalSection>
      <LegalSection heading="4. Conservación y seguridad">
        <p>
          Conservamos los datos durante el tiempo necesario para cumplir con
          obligaciones legales y comerciales. Aplicamos medidas técnicas y
          organizativas razonables para protegerlos contra accesos no
          autorizados.
        </p>
      </LegalSection>
      <LegalSection heading="5. Tus derechos">
        <p>
          Podés solicitar el acceso, rectificación, actualización o eliminación
          de tus datos escribiendo a info@tustorecr.com. Atendemos las
          solicitudes en los plazos establecidos por la ley.
        </p>
      </LegalSection>
      <LegalSection heading="6. Cookies y analítica">
        <p>
          Este sitio usa cookies y herramientas de analítica para mejorar la
          experiencia de navegación y medir el tráfico de forma agregada y
          anónima. Podés desactivar las cookies desde tu navegador.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

