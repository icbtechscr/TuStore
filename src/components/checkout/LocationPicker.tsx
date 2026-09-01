"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Search, Loader2, MapPin, LocateFixed } from "lucide-react";

export type LatLng = { lat: number; lng: number };
export type PickedLocation = {
  lat: number;
  lng: number;
  province?: string;
  canton?: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  place_id: number;
};

const CR_CENTER: LatLng = { lat: 9.9333, lng: -84.0833 }; // San José

export function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (v: PickedLocation) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Emite la ubicación y, en segundo plano, agrega provincia/cantón.
  async function emit(lat: number, lng: number) {
    onChangeRef.current({ lat, lng });
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`
      );
      const j = (await res.json()) as {
        address?: Record<string, string>;
      };
      const a = j.address ?? {};
      const province = a.state;
      const canton =
        a.county || a.city || a.town || a.municipality || a.village;
      onChangeRef.current({ lat, lng, province, canton });
    } catch {
      /* sin reverse-geocoding, queda solo lat/lng */
    }
  }

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41],
      });

      const start = value ?? CR_CENTER;
      const map = L.map(containerRef.current).setView(
        [start.lat, start.lng],
        value ? 15 : 8
      );
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        icon,
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        emit(p.lat, p.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        emit(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => map.invalidateSize(), 200);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=cr&limit=5&q=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url);
      const data = (await res.json()) as NominatimResult[];
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function moveTo(lat: number, lng: number, zoom = 16) {
    mapRef.current?.setView([lat, lng], zoom);
    markerRef.current?.setLatLng([lat, lng]);
    emit(lat, lng);
  }

  function pick(item: NominatimResult) {
    moveTo(parseFloat(item.lat), parseFloat(item.lon));
    setResults([]);
    setQuery(item.display_name.split(",").slice(0, 2).join(", "));
  }

  function locateMe() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        moveTo(pos.coords.latitude, pos.coords.longitude, 17);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div>
      {/* Leaflet CSS — React 19 lo eleva al <head> */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doSearch();
              }
            }}
            placeholder="Ejemplo: Condominio Las Flores, Heredia"
            className="w-full rounded-xl border border-ink-200 bg-white py-3 pl-10 pr-24 text-sm text-ink-900 outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={doSearch}
            disabled={searching}
            className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {searching ? <Loader2 className="size-3.5 animate-spin" /> : "Buscar"}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white shadow-lg">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-ink-400">
          Buscá tu zona y <b>arrastrá el pin</b> al punto exacto.
        </p>
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LocateFixed className="size-3.5" />
          )}
          Marcar mi ubicación
        </button>
      </div>

      <div
        ref={containerRef}
        className="mt-2 h-64 w-full overflow-hidden rounded-2xl border border-ink-200"
        style={{ zIndex: 0 }}
      />
    </div>
  );
}
