export type Branch = {
  id: string;
  city: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  gmaps: string;
  waze: string;
  cedi?: boolean;
  remote?: boolean;
  entryTime?: string;
};

export const DEFAULT_ENTRY_TIME = "08:00";
export const ENTRY_GRACE_MIN = 10;

export function getBranchEntryTime(id: string | null | undefined): string {
  const branch = id ? BRANCHES.find((item) => item.id === id) : undefined;
  return branch?.entryTime || DEFAULT_ENTRY_TIME;
}

export const BRANCHES: Branch[] = [
  {
    id: "barreal-heredia",
    city: "Barreal de Heredia",
    name: "TUStore Costa Rica",
    address: "ModyPlaza, local 14, frente a CENADA, Barreal de Heredia.",
    phone: "+506 4002 5649",
    lat: 9.9812842,
    lng: -84.1513852,
    gmaps: "https://maps.app.goo.gl/jatydzHVitGKQ4Av6",
    waze:
      "https://ul.waze.com/ul?place=ChIJm49cynz972gRUN6acuCstkI&ll=9.98128420%2C-84.15138520&navigate=yes",
    entryTime: "08:00",
  },
];

export const BRANCH_RADIUS_M = 200;

export const REMOTE_LOCATION: Branch = {
  id: "remoto",
  city: "Trabajo remoto",
  name: "Trabajo remoto",
  address: "Desde casa / cualquier lugar",
  phone: "",
  lat: 0,
  lng: 0,
  gmaps: "",
  waze: "",
  remote: true,
};

export const WORK_LOCATIONS: Branch[] = [...BRANCHES, REMOTE_LOCATION];

export function getBranch(id: string | null | undefined): Branch | undefined {
  if (!id) return undefined;
  return BRANCHES.find((branch) => branch.id === id);
}

export function getLocation(id: string | null | undefined): Branch | undefined {
  if (!id) return undefined;
  return WORK_LOCATIONS.find((location) => location.id === id);
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const radius = 6371000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
