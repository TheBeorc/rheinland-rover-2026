import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";

import type { Poi } from "@/lib/poi";
import { renderPoiIcon } from "@/lib/poi-icons";
import { useWatchPosition } from "@/lib/geolocation";
import { useRoutes, ROUTE_STYLE, type RouteFeature } from "@/lib/routes";
import { Crosshair, MapPin } from "lucide-react";

// --- Constants ---
const ARAN_BOUNDS: L.LatLngBoundsExpression = [
  [44.5, 5.8],
  [50.6, 13.9],
];
const INITIAL_CENTER: L.LatLngExpression = [48.8, 9.5];
const INITIAL_ZOOM = 7;

// Carto Voyager - free, friendly, no key
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// --- Marker icon builders ---
function buildPoiDivIcon(poi: Poi): L.DivIcon {
  const svg = renderToStaticMarkup(renderPoiIcon(poi.icon_type));
  const approx = poi.coord_precision !== "precise";
  const isMain = poi.main === true;
  const size = isMain ? 44 : 31;
  const cls = [
    "aran-marker",
    approx ? "aran-marker--approx" : "aran-marker--precise",
    isMain ? "aran-marker--main" : "aran-marker--small",
  ].join(" ");
  const badge = isMain ? `<div class="aran-marker__badge"></div>` : "";
  return L.divIcon({
    html: `<div class="${cls}" style="width:${size}px;height:${size}px"><div class="aran-marker__halo"></div><div class="aran-marker__icon">${svg}</div>${badge}</div>`,
    className: "aran-marker-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildUserIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div class="aran-user"><span class="aran-user__pulse"></span><span class="aran-user__dot"></span></div>`,
    className: "aran-user-wrap",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// --- Inner layers ---
function PoiClusterLayer({
  pois,
  onSelect,
}: {
  pois: Poi[];
  onSelect: (poi: Poi) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const ClusterCtor = (L as unknown as { markerClusterGroup: (o: object) => L.LayerGroup })
      .markerClusterGroup;
    const cluster = ClusterCtor({
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: false,
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      iconCreateFunction: (c: {
        getChildCount: () => number;
        getAllChildMarkers: () => Array<{ options: { hasMain?: boolean } }>;
      }) => {
        const n = c.getChildCount();
        const hasMain = c.getAllChildMarkers().some((m) => m.options.hasMain === true);
        return L.divIcon({
          html: `<div class="aran-cluster${hasMain ? " aran-cluster--main" : ""}"><span>${n}</span></div>`,
          className: "aran-cluster-wrap",
          iconSize: [40, 40],
        });
      },
    }) as L.LayerGroup & { addLayer: (l: L.Layer) => void };

    pois.forEach((poi) => {
      const m = L.marker([poi.lat, poi.long], {
        icon: buildPoiDivIcon(poi),
        zIndexOffset: poi.main ? 1000 : 0,
        // @ts-expect-error custom option read by iconCreateFunction
        hasMain: poi.main === true,
      });
      m.bindTooltip(poi.name, {
        direction: "top",
        offset: [0, -18],
        opacity: 1,
        className: "aran-tooltip",
      });
      m.on("click", () => onSelect(poi));
      cluster.addLayer(m);
    });

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, pois, onSelect]);
  return null;
}

function UserLocationLayer({
  fix,
  geoStatus,
  pois,
  setRecenter,
}: {
  fix: { lat: number; lng: number; accuracy: number } | null;
  geoStatus: string;
  pois: Poi[];
  setRecenter: (fn: () => void) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const autoAppliedRef = useRef(false);

  const bounds = L.latLngBounds(ARAN_BOUNDS as L.LatLngBoundsLiteral);
  const userInBounds = !!fix && bounds.contains([fix.lat, fix.lng]);

  // Recompute the recenter action whenever inputs change
  useEffect(() => {
    setRecenter(() => () => {
      if (fix && userInBounds) {
        map.flyTo([fix.lat, fix.lng], 13, { duration: 0.8 });
      } else if (pois.length > 0) {
        const poiBounds = L.latLngBounds(pois.map((p) => [p.lat, p.long] as [number, number]));
        map.flyToBounds(poiBounds, { padding: [40, 40], duration: 0.8 });
      }
    });
  }, [fix, userInBounds, pois, map, setRecenter]);

  // Start zoomed to the bounding box; we'll override with GPS once resolved.
  useEffect(() => {
    if (autoAppliedRef.current) return;
    map.fitBounds(ARAN_BOUNDS as L.LatLngBoundsLiteral, { padding: [40, 40] });
  }, [map]);

  // Smart initial view: apply once GPS resolves (granted/denied/unavailable/error)
  useEffect(() => {
    if (autoAppliedRef.current) return;
    const resolved =
      geoStatus === "granted" ||
      geoStatus === "denied" ||
      geoStatus === "unavailable" ||
      geoStatus === "error";
    if (!resolved) return;

    if (fix && userInBounds) {
      map.setView([fix.lat, fix.lng], 13);
    } else {
      map.fitBounds(ARAN_BOUNDS as L.LatLngBoundsLiteral, { padding: [40, 40] });
    }
    autoAppliedRef.current = true;
  }, [fix, userInBounds, geoStatus, map]);

  // Marker management
  useEffect(() => {
    if (!fix) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([fix.lat, fix.lng], {
        icon: buildUserIcon(),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([fix.lat, fix.lng]);
    }
  }, [fix, map]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  if (!fix || !userInBounds) return null;
  return (
    <Circle
      center={[fix.lat, fix.lng]}
      radius={fix.accuracy}
      pathOptions={{
        color: "var(--color-sea-deep)",
        fillColor: "var(--color-sea)",
        fillOpacity: 0.15,
        weight: 1,
      }}
    />
  );
}

function FlyToOnSelect({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const size = map.getSize();
    const sheetOffsetPx = Math.min(size.y * 0.35, 240);
    const pt = map.project([target.lat, target.lng], map.getZoom());
    pt.y += sheetOffsetPx / 2;
    const newLatLng = map.unproject(pt, map.getZoom());
    map.flyTo(newLatLng, Math.max(map.getZoom(), 14), { duration: 0.7 });
  }, [target, map]);
  return null;
}

function MapClickCloser({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: () => onClose() });
  return null;
}

function RoutesLayer({ routes }: { routes: RouteFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (!routes.length) return;
    const layers: L.Layer[] = [];
    routes.forEach((r) => {
      const style = ROUTE_STYLE[r.properties.mode];
      const latlngs = r.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      const line = L.polyline(latlngs, {
        color: style.color,
        weight: 4,
        opacity: 0.9,
        dashArray: style.dashArray,
        lineCap: "round",
        lineJoin: "round",
      });
      line.bindTooltip(r.properties.name, { sticky: true, className: "aran-tooltip" });
      line.addTo(map);
      layers.push(line);
    });
    return () => {
      layers.forEach((l) => map.removeLayer(l));
    };
  }, [map, routes]);
  return null;
}

// --- Main component ---
export interface AranMapProps {
  pois: Poi[];
  selected: Poi | null;
  onSelect: (poi: Poi | null) => void;
}

export default function AranMap({ pois, selected, onSelect }: AranMapProps) {
  const geo = useWatchPosition();
  const [recenter, setRecenter] = useState<() => void>(() => () => {});
  const [geoNoticeDismissed, setGeoNoticeDismissed] = useState(false);
  const { data: routes = [] } = useRoutes();

  const selectedTarget = useMemo(
    () => (selected ? { lat: selected.lat, lng: selected.long } : null),
    [selected],
  );

  const showGeoNotice =
    !geoNoticeDismissed && (geo.status === "denied" || geo.status === "unavailable" || geo.status === "error");

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={INITIAL_CENTER}
        zoom={INITIAL_ZOOM}
        minZoom={6}
        maxZoom={18}
        maxBounds={ARAN_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        attributionControl={true}
        className="h-full w-full"
        style={{ background: "var(--color-sea)" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} className="aran-tiles" />
        <PoiClusterLayer pois={pois} onSelect={onSelect} />
        <RoutesLayer routes={routes} />
        <UserLocationLayer fix={geo.fix} geoStatus={geo.status} pois={pois} setRecenter={setRecenter} />
        <FlyToOnSelect target={selectedTarget} />
        <MapClickCloser onClose={() => onSelect(null)} />
      </MapContainer>


      {/* Title chip */}
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-sm font-semibold text-foreground shadow-md backdrop-blur">
        <MapPin className="h-4 w-4 text-[var(--color-sea-deep)]" />
        The Rheinland Rover 2026
      </div>

      {/* Legend */}
      {routes.length > 0 && (
        <div className="absolute left-3 bottom-6 z-[1000] rounded-xl bg-card/95 px-3 py-2 text-xs text-foreground shadow-md backdrop-blur">
          <div className="mb-1 font-semibold">Legend</div>
          <div className="flex items-center gap-2">
            <svg width="28" height="6" aria-hidden>
              <line x1="0" y1="3" x2="28" y2="3" stroke={ROUTE_STYLE.car.color} strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span>Driving</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <svg width="28" height="6" aria-hidden>
              <line x1="0" y1="3" x2="28" y2="3" stroke={ROUTE_STYLE.walk.color} strokeWidth="4" strokeLinecap="round" strokeDasharray="2 6" />
            </svg>
            <span>Walking</span>
          </div>
        </div>
      )}

      {/* Recenter FAB */}
      <button
        type="button"
        onClick={() => recenter()}
        disabled={!geo.fix}
        className="absolute bottom-6 right-4 z-[1000] flex h-12 w-12 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border transition active:scale-95 disabled:opacity-50"
        aria-label="Recenter on my location"
      >
        <Crosshair className="h-5 w-5" />
      </button>

      {showGeoNotice && (
        <div className="absolute left-3 right-3 top-14 z-[1000] flex items-start justify-between gap-3 rounded-xl bg-card/95 px-3 py-2 text-xs text-foreground shadow-md backdrop-blur sm:left-auto sm:right-3 sm:max-w-xs">
          <p>
            {geo.status === "denied"
              ? "Location permission denied. The map still works — you just won't see your position."
              : geo.status === "unavailable"
                ? "Your device doesn't support location. The map still works without it."
                : "Couldn't get your location right now."}
          </p>
          <button
            onClick={() => setGeoNoticeDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
