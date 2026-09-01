// Encomiendas de Costa Rica — basado 1:1 en "encomiendas_costa_rica.xlsx".
// Cada servicio tiene su zona principal y dos tarifas:
//   - motoRate: pedido pequeño (cabe en motocicleta)
//   - carRate:  pedido grande (requiere carro)
// El cliente elige el servicio/zona + tamaño y se calcula el costo.

export type PackageSize = "moto" | "carro";

export type ShippingZone = {
  id: string;
  label: string; // nombre del servicio de encomienda (Excel)
  zone: string; // zona principal (Excel)
  coverage: string; // destinos / cobertura (Excel)
  motoRate: number;
  carRate: number;
};

export const SHIPPING_ZONES: ShippingZone[] = [
  {
    id: "correos",
    label: "Correos de Costa Rica - Encomienda Nacional",
    zone: "Nacional",
    coverage: "Cobertura nacional: GAM y todo el país.",
    motoRate: 8000,
    carRate: 10000,
  },
  {
    id: "bodega-anay",
    label: "Bodega ANAY",
    zone: "Nacional",
    coverage: "Encomiendas a domicilio en diversos puntos del país.",
    motoRate: 7000,
    carRate: 11000,
  },
  {
    id: "caribenos",
    label: "Encomiendas Caribeños",
    zone: "Caribe / Limón",
    coverage: "Guápiles, Siquirres, Limón, Matina, Guácimo, Cariari y zona Caribe.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "guapilenos",
    label: "Encomiendas Guapileños",
    zone: "Caribe / Pococí",
    coverage: "Guápiles, Cariari, Roxana, La Rita, Jiménez, Pococí y alrededores.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "tracopa",
    label: "TRACOPA Encomiendas",
    zone: "Zona Sur / Pacífico Sur",
    coverage:
      "Quepos, Parrita, Uvita, Dominical, Palmar, Golfito, Ciudad Neily, Paso Canoas, Buenos Aires, San Vito.",
    motoRate: 7000,
    carRate: 12000,
  },
  {
    id: "musoc",
    label: "MUSOC Encomiendas",
    zone: "Pérez Zeledón / Los Santos",
    coverage: "San Isidro de Pérez Zeledón, Tarrazú, Dota, León Cortés.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "blanco",
    label: "Transportes Blanco",
    zone: "Zona Sur",
    coverage:
      "Ciudad Neily, Dominical, San Isidro del General, Puerto Jiménez, Palmar Norte, Quepos.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "transcama",
    label: "Transcama",
    zone: "Zona Sur y nacional",
    coverage: "Zona sur y resto del país (encomiendas, carga y mudanzas).",
    motoRate: 5000,
    carRate: 9000,
  },
  {
    id: "empresarios-unidos",
    label: "Empresarios Unidos de Puntarenas",
    zone: "Puntarenas / Pacífico Central",
    coverage: "Puntarenas, Esparza, El Roble y San Ramón.",
    motoRate: 4000,
    carRate: 9000,
  },
  {
    id: "curubande",
    label: "Curubandé Express",
    zone: "Guanacaste",
    coverage:
      "Liberia, Playas del Coco, Tamarindo, Santa Cruz, Cañas, La Cruz, Papagayo.",
    motoRate: 5000,
    carRate: 9000,
  },
  {
    id: "tig",
    label: "TIG - Transporte Inteligente de Guanacaste",
    zone: "Guanacaste",
    coverage: "Nicoya, Nosara, Santa Cruz y Tamarindo.",
    motoRate: 5000,
    carRate: 9000,
  },
  {
    id: "sancarlenos",
    label: "Transportes Sancarleños / DESC",
    zone: "Zona Norte",
    coverage: "Ciudad Quesada, La Fortuna, Guatuso, Pital, Venecia, Zarcero.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "ocampo",
    label: "Transportes Ocampo",
    zone: "Caribe / Zona Norte / conexiones",
    coverage:
      "Guápiles, Cariari, Guácimo; conexiones con Alajuela, Heredia, Cañas, Tilarán, Arenal.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "ms-mc",
    label: "Transportes MS y MC",
    zone: "Caribe / Limón",
    coverage: "Limón, Siquirres, Batán y otros puntos del Caribe.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "transtusa",
    label: "Transtusa",
    zone: "Cartago / Turrialba",
    coverage: "Cartago, Paraíso y Turrialba.",
    motoRate: 4000,
    carRate: 8000,
  },
  {
    id: "morita",
    label: "Morita Express",
    zone: "Zona Norte",
    coverage: "Ciudad Quesada, La Fortuna y Chachagua.",
    motoRate: 5000,
    carRate: 9000,
  },
];

// Servicios agrupados por zona principal (para el selector con optgroups).
export const ZONE_GROUPS: { zone: string; services: ShippingZone[] }[] = (() => {
  const m = new Map<string, ShippingZone[]>();
  for (const z of SHIPPING_ZONES) {
    if (!m.has(z.zone)) m.set(z.zone, []);
    m.get(z.zone)!.push(z);
  }
  return [...m.entries()].map(([zone, services]) => ({ zone, services }));
})();

export function getZone(id: string | null | undefined): ShippingZone | undefined {
  return SHIPPING_ZONES.find((z) => z.id === id);
}

export function zoneRate(zone: ShippingZone, size: PackageSize): number {
  return size === "carro" ? zone.carRate : zone.motoRate;
}

// Origen de los envíos: TUStore Barreal.
export const ORIGIN = { lat: 9.9812842, lng: -84.1513852 };

// Tarifa estimada por kilómetro desde TUStore Barreal.
export const PER_KM_RATE = 750;

/** Costo de envío a domicilio según la distancia al punto marcado. */
export function distanceShippingCost(
  lat: number | null | undefined,
  lng: number | null | undefined
): number {
  if (typeof lat !== "number" || typeof lng !== "number") return 0;
  const km = Math.max(1, distanceKm(ORIGIN.lat, ORIGIN.lng, lat, lng));
  return km * PER_KM_RATE;
}

// Sugiere un servicio de encomienda según la provincia/cantón del punto marcado.
export function zoneFromLocation(
  province?: string | null,
  canton?: string | null
): string {
  const p = (province || "").toLowerCase();
  const c = (canton || "").toLowerCase();
  const has = (s: string) => c.includes(s);

  if (p.includes("guanacaste")) return "curubande";

  if (p.includes("limón") || p.includes("limon")) {
    if (has("pococí") || has("pococi") || has("guápiles") || has("guapiles"))
      return "guapilenos";
    return "caribenos";
  }

  if (p.includes("puntarenas")) {
    const sur = [
      "osa",
      "golfito",
      "corredores",
      "coto brus",
      "buenos aires",
      "quepos",
      "parrita",
      "garabito",
    ];
    if (sur.some(has)) return "tracopa";
    return "empresarios-unidos";
  }

  if (p.includes("cartago")) return "transtusa";

  if (p.includes("san josé") || p.includes("san jose")) {
    const losSantos = [
      "pérez zeledón",
      "perez zeledon",
      "tarrazú",
      "tarrazu",
      "dota",
      "león cortés",
      "leon cortes",
    ];
    if (losSantos.some(has)) return "musoc";
    return "correos";
  }

  if (p.includes("alajuela")) {
    const norte = [
      "san carlos",
      "quesada",
      "upala",
      "los chiles",
      "guatuso",
      "zarcero",
      "sarchí",
      "sarchi",
      "naranjo",
    ];
    if (norte.some(has)) return "sancarlenos";
    return "correos";
  }

  if (p.includes("heredia")) {
    if (has("sarapiquí") || has("sarapiqui")) return "sancarlenos";
    return "correos";
  }

  return "correos";
}

/** Distancia aproximada en km entre dos coordenadas (Haversine). */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

