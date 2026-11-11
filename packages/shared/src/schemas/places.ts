export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  source?: 'vietmap' | 'osm';
  lat?: number;
  lng?: number;
};
