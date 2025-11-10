export interface GeoSample {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  reportedAt: string; // ISO
}