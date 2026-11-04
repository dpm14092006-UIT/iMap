import type { DemoPlace } from '../types';

/** TP.HCM sample points from Webdemo.html, now positioned on the real Leaflet map. */
export const demoPlaces: DemoPlace[] = [
  { id: 'ben-thanh', name: 'Chợ Bến Thành', district: 'Quận 1', category: 'Điểm tham quan', lat: 10.7721, lng: 106.6983, source: 'demo' },
  { id: 'park-239', name: 'Công viên 23/9', district: 'Quận 1', category: 'Công viên', lat: 10.7677, lng: 106.6929, source: 'demo' },
  { id: 'tao-dan', name: 'Công viên Tao Đàn', district: 'Quận 1', category: 'Công viên', lat: 10.7757, lng: 106.6900, source: 'demo' },
  { id: 'independence', name: 'Dinh Độc Lập', district: 'Quận 1', category: 'Di tích lịch sử', lat: 10.7770, lng: 106.6952, source: 'demo' },
  { id: 'notre-dame', name: 'Nhà thờ Đức Bà', district: 'Quận 1', category: 'Điểm tham quan', lat: 10.7796, lng: 106.6990, source: 'demo' },
  { id: 'turtle-lake', name: 'Hồ Con Rùa', district: 'Quận 3', category: 'Điểm tham quan', lat: 10.7831, lng: 106.6982, source: 'demo' },
  { id: 'nguyen-hue', name: 'Phố đi bộ Nguyễn Huệ', district: 'Quận 1', category: 'Phố đi bộ', lat: 10.7736, lng: 106.7043, source: 'demo' },
  { id: 'bach-dang', name: 'Bến Bạch Đằng', district: 'Quận 1', category: 'Điểm tham quan', lat: 10.7726, lng: 106.7074, source: 'demo' },
  { id: 'ba-son', name: 'Khu vực Ba Son', district: 'Quận 1', category: 'Khu vực', lat: 10.7828, lng: 106.7085, source: 'demo' },
  { id: 'zoo', name: 'Thảo Cầm Viên', district: 'Quận 1', category: 'Công viên', lat: 10.7874, lng: 106.7049, source: 'demo' },
  { id: 'le-van-tam', name: 'Công viên Lê Văn Tám', district: 'Quận 1', category: 'Công viên', lat: 10.7890, lng: 106.6983, source: 'demo' },
  { id: 'tan-dinh', name: 'Chợ Tân Định', district: 'Quận 3', category: 'Chợ', lat: 10.7930, lng: 106.6913, source: 'demo' },
  { id: 'hang-xanh', name: 'Ngã tư Hàng Xanh', district: 'Bình Thạnh', category: 'Nút giao', lat: 10.8016, lng: 106.7143, source: 'demo' },
  { id: 'landmark', name: 'Landmark 81', district: 'Bình Thạnh', category: 'Địa điểm nổi bật', lat: 10.7949, lng: 106.7218, source: 'demo' },
  { id: 'thu-thiem', name: 'Khu đô thị Thủ Thiêm', district: 'Thủ Đức', category: 'Khu đô thị', lat: 10.7827, lng: 106.7173, source: 'demo' },
  { id: 'thao-dien', name: 'Thảo Điền', district: 'Thủ Đức', category: 'Khu vực', lat: 10.8031, lng: 106.7308, source: 'demo' },
  { id: 'phu-nhuan', name: 'Ngã tư Phú Nhuận', district: 'Phú Nhuận', category: 'Nút giao', lat: 10.7993, lng: 106.6820, source: 'demo' },
  { id: 'dien-bien-phu', name: 'Điện Biên Phủ – Q.3', district: 'Quận 3', category: 'Khu vực', lat: 10.7859, lng: 106.6885, source: 'demo' },
  { id: 'central-post-office', name: 'Bưu điện trung tâm', district: 'Quận 1', category: 'Điểm tham quan', lat: 10.7799, lng: 106.7010, source: 'demo' },
  { id: 'da-kao', name: 'Đa Kao', district: 'Quận 1', category: 'Khu vực', lat: 10.7856, lng: 106.7020, source: 'demo' },
  { id: 'thu-thiem-tunnel', name: 'Đầu hầm Thủ Thiêm (Q.1)', district: 'Quận 1', category: 'Khu vực', lat: 10.7735, lng: 106.7100, source: 'demo' },
  { id: 'an-phu', name: 'An Phú', district: 'Thủ Đức', category: 'Khu vực', lat: 10.8024, lng: 106.7464, source: 'demo' },
  { id: 'tan-son-nhat', name: 'Sân bay Tân Sơn Nhất', district: 'Tân Bình', category: 'Sân bay', lat: 10.8187, lng: 106.6520, source: 'demo' },
  { id: 'national-university', name: 'Đại học Quốc gia TP.HCM', district: 'Thủ Đức', category: 'Trường đại học', lat: 10.8712, lng: 106.7970, source: 'demo' },
  { id: 'ba-chieu', name: 'Chợ Bà Chiểu', district: 'Bình Thạnh', category: 'Chợ', lat: 10.7991, lng: 106.6970, source: 'demo' },
  { id: 'cho-ray', name: 'Bệnh viện Chợ Rẫy', district: 'Quận 5', category: 'Bệnh viện', lat: 10.7573, lng: 106.6590, source: 'demo' },
  { id: 'aeon-tan-phu', name: 'AEON Mall Tân Phú', district: 'Tân Phú', category: 'Trung tâm thương mại', lat: 10.8029, lng: 106.6170, source: 'demo' },
  { id: 'ben-xe-mien-dong-moi', name: 'Bến xe Miền Đông mới', district: 'Thủ Đức', category: 'Bến xe', lat: 10.8782, lng: 106.8150, source: 'demo' },
  { id: 'gia-dinh-park', name: 'Công viên Gia Định', district: 'Gò Vấp', category: 'Công viên', lat: 10.8179, lng: 106.6800, source: 'demo' },
  { id: 'ben-xe-mien-tay', name: 'Bến xe Miền Tây', district: 'Bình Tân', category: 'Bến xe', lat: 10.7414, lng: 106.6200, source: 'demo' },
];

export const routePlaces = demoPlaces;
export const popularPlaces = demoPlaces.slice(0, 5);
