export class GeoPoint {
  constructor(public readonly lat: number, public readonly lng: number) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new RangeError('Tọa độ không hợp lệ');
    }
  }
  /** Thứ tự GeoJSON: [kinh độ, vĩ độ] */
  toGeoJson(): [number, number] { return [this.lng, this.lat]; }
}
