/** Tọa độ dạng đối tượng, theo định dạng JSON của dự án: {lat, lng}. */
export type LatLng = { lat: number; lng: number };

/** Tọa độ theo thứ tự nội bộ: [lat, lng] (ngược với GeoJSON [lng, lat]). */
export type Coordinate = [number, number];

export const toLatLng = ([lat, lng]: Coordinate): LatLng => ({ lat, lng });
