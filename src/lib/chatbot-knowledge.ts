// Conocimiento del negocio que alimenta al chatbot IA.
// El bot SOLO sabe lo que esté aquí (más lo que consulte en vivo del catálogo).
// Mantener esta información actualizada para que las respuestas sean correctas.
import { BRANCHES } from "./branches";

// Texto con las sucursales, generado a partir de la fuente de verdad (branches.ts)
// para no duplicar direcciones ni teléfonos.
function buildBranchesText(): string {
  return BRANCHES.filter((b) => !b.cedi && !b.remote)
    .map(
      (b) =>
        `- ${b.city}: ${b.name}. Dirección: ${b.address} Teléfono: ${b.phone}.`
    )
    .join("\n");
}

export const TUSTORE_KNOWLEDGE = `
## Sobre TUStore Costa Rica
TUStore Costa Rica es una tienda de tecnología y electrónica. Su catálogo incluye
computadoras y accesorios, gadgets, dispositivos inteligentes, periféricos,
seguridad CCTV, redes cableadas e inalámbricas, hogar y punto de venta.
Sitio web: https://tustorecr.com

## Tienda
${buildBranchesText()}
Para llegar, la persona puede consultar el enlace de Google Maps o Waze en la
página /sucursales del sitio.

## Horario de atención
Lunes a sábado de 8:00 a.m. a 6:00 p.m. Si la persona necesita confirmar atención
en un feriado, sugiere contactar a la tienda por WhatsApp o teléfono.

## Métodos de pago
La compra se coordina con un asesor por WhatsApp. El asesor confirma las opciones
disponibles de SINPE, transferencia, efectivo o enlace de pago antes de cobrar.
No inventes cuentas bancarias, números de tarjeta ni condiciones de pago.

## Envíos
TUStore realiza envíos a todo Costa Rica. La tarifa, el transportista y el plazo
dependen del destino y del producto; un asesor los confirma antes de finalizar la
compra. No prometas envío gratuito, contra entrega ni una fecha sin confirmación.

## Garantía, cambios y devoluciones
La garantía y las condiciones de cambio dependen del producto y del fabricante.
Para un caso concreto, solicita número de pedido, producto y detalle del problema,
y remite a un asesor. No inventes plazos ni coberturas.

## Contacto
La persona puede escribir o llamar y un asesor la atenderá. Los teléfonos por
sucursal están arriba. También está la página /contacto del sitio.

## Catálogo de productos
Puedes consultar el catálogo real (precios, disponibilidad y nombres exactos)
usando la herramienta de búsqueda de productos. Úsala siempre que la persona
pregunte por un producto, precio, marca o disponibilidad concreta, en lugar de
inventar datos. Los precios están en colones costarricenses (CRC, ₡).
`.trim();

