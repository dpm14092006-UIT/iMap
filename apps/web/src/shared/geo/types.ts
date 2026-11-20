/** Tọa độ dạng đối tượng, theo định dạng JSON của dự án: {lat, lng}. */
export type LatLng = { lat: number; lng: number };

/** Tọa độ theo thứ tự Leaflet: [lat, lng] (ngược với GeoJSON [lng, lat]). */
export type Coordinate = [number, number];

/** Khung hình chữ nhật theo tọa độ. */
export type Bounds = { south: number; west: number; north: number; east: number };

export const toLatLng = ([lat, lng]: Coordinate): LatLng => ({ lat, lng });
export const toCoordinate = ({ lat, lng }: LatLng): Coordinate => [lat, lng];
