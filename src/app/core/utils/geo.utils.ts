export type LatLng = { lat: number; lng: number };

export function pointToLatLng(point?: { type: 'Point'; coordinates: [number, number] } | null): LatLng | null {
  if (!point || point.type !== 'Point' || !Array.isArray(point.coordinates)) return null;
  const [lng, lat] = point.coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

export function latLngToPoint(lat: number, lng: number) {
  return { type: 'Point' as const, coordinates: [lng, lat] as [number, number] };
}

export function fromGeoPoint(point?: { type: 'Point'; coordinates: [number, number] } | null) {
  if (!point || point.type !== 'Point' || !Array.isArray(point.coordinates)) return null;
  const [lng, lat] = point.coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}
