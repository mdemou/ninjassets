import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

// Vite serves the marker images as hashed URLs. Leaflet's Default icon otherwise
// prepends an auto-detected imagePath to these (already-absolute) URLs, which 404s
// and renders a broken image — so drop that override before wiring the real URLs.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Sensible default view (roughly centered on Spain) when nothing is placed yet.
const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038];
const DEFAULT_ZOOM = 5;

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

interface LocationMapProps {
  markers: MapMarker[];
  className?: string;
}

/** Pans/zooms the map to fit all markers whenever they change. */
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [markers, map]);
  return null;
}

/** Read-only map rendering a pin (with optional popup) for each marker. */
export function LocationMap({ markers, className }: LocationMapProps) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className={className ?? 'h-[200px] w-full rounded-lg z-0'}
    >
      <TileLayer
        url={OSM_URL}
        attribution={OSM_ATTRIBUTION}
      />
      <FitBounds markers={markers} />
      <MarkerClusterGroup chunkedLoading>
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  className?: string;
}

/** Captures clicks on the map and reports the picked coordinates. */
function ClickCapture({ onChange }: { onChange: LocationPickerProps['onChange'] }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Interactive map: click anywhere or drag the pin to set a coordinate. */
export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const center = useMemo<[number, number]>(() => (value ? [value.lat, value.lng] : DEFAULT_CENTER), [value]);

  return (
    <MapContainer
      center={center}
      zoom={value ? 13 : DEFAULT_ZOOM}
      scrollWheelZoom
      className={className ?? 'h-[300px] w-full rounded-lg z-0'}
    >
      <TileLayer
        url={OSM_URL}
        attribution={OSM_ATTRIBUTION}
      />
      <ClickCapture onChange={onChange} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          draggable
          eventHandlers={{
            dragend(e) {
              const { lat, lng } = (e.target as L.Marker).getLatLng();
              onChange({ lat, lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
