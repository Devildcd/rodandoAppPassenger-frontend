export type LatLng = { lat: number; lng: number };

export interface PlaceSuggestion {
  id: string;                 // feature.id de Mapbox
  text: string;               // título corto (main text)
  placeName: string;          // “calle, ciudad, país”
  coords: LatLng;             // centro [lat,lng]
}
