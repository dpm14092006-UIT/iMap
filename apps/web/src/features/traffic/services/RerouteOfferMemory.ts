import type { LatLng } from '../../places/types';

function roughDistanceMeters(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const north = (b.lat - a.lat) * 111_320;
  return Math.hypot(east, north);
}

/**
 * Nhớ các sự cố đã hỏi "đổi tuyến?" trong một chuyến, để mỗi sự cố (hoặc cụm báo cáo gần nhau)
 * chỉ hỏi một lần. Chỉ được ghi nhớ sự cố NẰM TRÊN tuyến: nếu ghi cả sự cố cạnh tuyến thì một báo cáo
 * cách tuyến 150 m đến trước sẽ khiến báo cáo trên tuyến cách nó 60 m không bao giờ được tìm đường tránh.
 */
export class RerouteOfferMemory {
  private readonly offered = new Map<string, LatLng>();

  /** @param clusterRadiusMeters Báo cáo trong bán kính này của một sự cố đã hỏi được coi là cùng sự cố. */
  constructor(private readonly clusterRadiusMeters: number) {}

  has(incident: { id: string } & LatLng): boolean {
    if (this.offered.has(incident.id)) return true;
    for (const point of this.offered.values()) {
      if (roughDistanceMeters(point, incident) <= this.clusterRadiusMeters) return true;
    }
    return false;
  }

  remember(incident: { id: string } & LatLng): void {
    this.offered.set(incident.id, { lat: incident.lat, lng: incident.lng });
  }

  clear(): void {
    this.offered.clear();
  }
}
