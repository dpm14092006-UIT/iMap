/**
 * Danh sách nguồn bản đồ nền (BasemapRegistry) và trạng thái kiểm chứng của từng nguồn.
 *
 * Quy tắc (IMAP V2 §6, §14):
 * - Bản build production CHỈ dùng nguồn APPROVED. Bản dev/kiểm thử dùng thêm TESTING để thu thập bằng chứng.
 * - Không có nguồn nào được tự coi là chuẩn: APPROVED cần người phụ trách ký duyệt (trường `approval`)
 *   sau khi đọc docs/basemap/SOVEREIGNTY_VALIDATION_REPORT.md và chạy `npm run verify:sovereignty -- --live`.
 * - Không bao giờ dự phòng về OpenStreetMap nguyên bản. Hết nguồn hợp lệ thì hiện thông báo bản đồ tạm không khả dụng.
 *
 * Căn cứ pháp lý: Thông tư 17/2018/TT-BTNMT (Văn bản hợp nhất 103/VBHN-BNNMT, 02/11/2026), Điều 19, 20.
 */
export type VerificationStatus = 'UNVERIFIED' | 'TESTING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
export type BasemapMode = 'street' | 'dark' | 'satellite' | 'admin' | 'terrain' | 'overview';
export type BasemapSourceType = 'maplibre-style' | 'arcgis-raster' | 'xyz-raster' | 'pmtiles';

export type BasemapProvider = {
  id: string;
  name: string;
  /** style.json (MapLibre) hoặc mẫu URL ô ảnh. Đường dẫn bắt đầu bằng "api:" đi qua proxy của API iMap. */
  url: string;
  sourceType: BasemapSourceType;
  attribution: string;
  license: string;
  modes: BasemapMode[];
  status: VerificationStatus;
  dataSource: string;
  lastVerified: string;
  version: string;
  /** Tóm tắt bằng chứng; chi tiết ở docs/basemap/PROVIDER_ASSESSMENT.md. */
  evidence: string[];
  /** Điều kiện còn thiếu để chuyển sang APPROVED (hoặc lý do bị chặn). */
  blockers: string[];
  /** Ai phê duyệt, ngày nào, theo báo cáo nào. Bắt buộc khi status = APPROVED. */
  approval?: { by: string; date: string; report: string };
  /**
   * Nguồn tự thể hiện tên chủ quyền (Hoàng Sa, Trường Sa, Biển Đông). Khi true, iMap không vẽ thêm nhãn
   * của mình để tránh chữ chồng chữ và không ghi đè dữ liệu của nguồn (IMAP V2 §8, §10).
   */
  sovereigntyLabels: boolean;
  /** Mức zoom ô ảnh gốc (raster). */
  zoom?: { min: number; max: number };
};

const VNSDI_ATTRIBUTION =
  '<a href="https://vnsdi.mae.gov.vn/" target="_blank" rel="noopener noreferrer">© Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam (VNSDI)</a>';

export const BASEMAP_PROVIDERS: readonly BasemapProvider[] = [
  {
    id: 'vnsdi-admin',
    sovereigntyLabels: true,
    name: 'VNSDI · Bản đồ hành chính Việt Nam',
    url: 'api:/map/vnsdi/admin/tile/{z}/{y}/{x}',
    sourceType: 'arcgis-raster',
    attribution: VNSDI_ATTRIBUTION,
    license: 'Dữ liệu nhà nước; điều kiện sử dụng theo tài khoản đăng ký VNSDI (chưa có văn bản cấp quyền).',
    modes: ['admin', 'overview'],
    status: 'BLOCKED',
    dataSource:
      'Trung tâm Hạ tầng dữ liệu không gian địa lý, Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam',
    lastVerified: '2026-11-26',
    version: 'ArcGIS Server 11.4 · BanDoHanhChinhVietNam/MapServer',
    evidence: [
      'REST metadata (qua trang công khai bandohanhchinh): EPSG:3857, ô PNG32 256px, LOD 0–23, cache tới mức 18.',
      'Phạm vi: x 7.235.720–16.697.877, y −2.273.080–5.621.455 (Web Mercator) — bao trọn 102°–118°E, 4,5°–23,5°N.',
      'Không token: HTTP 200 + JSON {"code":499,"message":"Token Required"}; CORS phản hồi đúng Origin.',
      'WMTS và WMS GetCapabilities cũng yêu cầu token (499).',
      'Mức 13 trở lên không có chi tiết đường phố: chỉ dùng cho tổng quan quốc gia, bản đồ phụ, lớp hành chính.',
    ],
    blockers: [
      'Cần tài khoản VNSDI và token (Đăng ký sử dụng dữ liệu → Đăng ký mới) — chủ dự án tự đăng ký.',
      'Cần văn bản/điều khoản cho phép dùng trong ứng dụng bên thứ ba.',
    ],
    zoom: { min: 0, max: 18 },
  },
  {
    id: 'vnsdi-terrain',
    sovereigntyLabels: false,
    name: 'VNSDI · Bản đồ nền địa hình',
    url: 'api:/map/vnsdi/terrain/tile/{z}/{y}/{x}',
    sourceType: 'arcgis-raster',
    attribution: `${VNSDI_ATTRIBUTION} · NASA, JAXA`,
    license: 'Như vnsdi-admin.',
    modes: ['terrain'],
    status: 'BLOCKED',
    dataSource: 'VNSDI; bóng địa hình NASA, JAXA (copyrightText của dịch vụ)',
    lastVerified: '2026-11-26',
    version: 'BanDoDiaHinh/MapServer',
    evidence: ['Cùng lưới ô với BanDoHanhChinhVietNam; không token: 499 Token Required.'],
    blockers: ['Cần token VNSDI.'],
    zoom: { min: 0, max: 18 },
  },
  {
    id: 'vnsdi-sentinel2',
    sovereigntyLabels: false,
    name: 'VNSDI · Ảnh Sentinel-2 không mây',
    url: 'https://vnsdi.mae.gov.vn/basemap/rest/services/Sentinel2/MapServer/tile/{z}/{y}/{x}',
    sourceType: 'arcgis-raster',
    attribution: `${VNSDI_ATTRIBUTION} · Ảnh Sentinel-2 (Copernicus)`,
    license:
      'Dịch vụ công khai, không yêu cầu token; chưa tìm thấy điều khoản sử dụng. Dữ liệu gốc Copernicus Sentinel-2 là dữ liệu mở.',
    modes: ['satellite'],
    status: 'TESTING',
    dataSource:
      'Trung tâm Hạ tầng dữ liệu không gian địa lý (xử lý tăng cường), ảnh gốc Copernicus Sentinel-2',
    lastVerified: '2026-11-26',
    version: 'Sentinel2/MapServer (singleFusedMapCache)',
    evidence: [
      'Danh mục công khai /basemap/rest/services liệt kê duy nhất Sentinel2; metadata đọc được không cần token.',
      'EPSG:3857, PNG32 256px; minScale 18.489.297 (≈ mức 5), maxScale 9.028 (≈ mức 16).',
      'Phạm vi lon 102,05°–117,97°, lat 6,84°–23,50° — chưa phủ phần cực nam vùng 4,5°–6,8°N.',
      'Ô mức 8 tại Việt Nam: HTTP 200 image/png.',
      'Ảnh không có nhãn: nhãn chủ quyền do lớp của iMap vẽ.',
    ],
    blockers: [
      'Ảnh không có đường biên giới quốc gia: chưa đạt Điều 20.1 khi xem toàn cảnh. Cần chồng lớp ranh giới chính thức (VNSDI hành chính, cần token) trước khi duyệt.',
      'Ở mức 5–7 ảnh là mosaic loang lổ; ngoài lãnh thổ trả ô trắng.',
      'Cần xác nhận điều khoản sử dụng với VNSDI.',
    ],
    zoom: { min: 5, max: 16 },
  },
  {
    id: 'vapp',
    sovereigntyLabels: true,
    name: 'vApp Map (map.vapp.vn)',
    url: 'https://map.vapp.vn/style.json',
    sourceType: 'maplibre-style',
    attribution:
      '<a href="https://map.vapp.vn/" target="_blank" rel="noopener noreferrer">© map.vapp.vn</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>',
    license:
      'Điều khoản map.vapp.vn (ERPFit, 2026-10-20): hiển thị miễn phí không cần khóa; gói Developer cho dự án cá nhân/học tập; cấm gỡ ghi nguồn, scraping, phân phối lại dữ liệu thô. Dữ liệu ODbL (OSM) + Overture + Wikidata.',
    // Tối: dùng style gốc (sáng) vì chưa xác nhận được quyền tự đổi style (IMAP V2 §10).
    modes: ['street', 'dark', 'overview'],
    status: 'APPROVED',
    dataSource: 'OpenStreetMap, Overture Maps, Wikidata, dữ liệu công khai Việt Nam (theo điều khoản vApp)',
    lastVerified: '2026-11-26',
    version: 'style "vapp-basemap", 19 lớp, có lớp sov-dots/sov-names',
    evidence: [
      'style.json, ô vector, font: HTTP 200, Access-Control-Allow-Origin: *, không cần khóa.',
      'Điều khoản: "thể hiện biên giới và chủ quyền Việt Nam, gồm quần đảo Hoàng Sa và Trường Sa".',
      'Quét ô vector quanh Biển Đông: có Hoàng Sa, Trường Sa, Biển Đông, Phú Lâm, Ba Bình; không có tên nước ngoài.',
      'Có lớp chủ quyền riêng (sov): iMap giữ nguyên, không ẩn, không đổi màu.',
    ],
    // Đã duyệt có điều kiện: các mục dưới đây vẫn mở, phải xử lý khi có token VNSDI / phản hồi của ERPFit.
    blockers: [
      'Chưa đối chiếu đường biên giới với bộ bản đồ chuẩn biên giới quốc gia (Điều 19) — cần token VNSDI.',
      'Điều khoản chưa nói rõ dùng thương mại và việc tự đổi style: cần hỏi support@erpfit.com.',
      'Dịch vụ alpha, không cam kết SLA.',
    ],
    approval: {
      by: 'Chủ dự án iMap (phê duyệt trong phiên làm việc với Claude Code)',
      date: '2026-11-26',
      report:
        'docs/basemap/SOVEREIGNTY_VALIDATION_REPORT.md — duyệt có điều kiện cho Đường phố, Tối (style gốc), tổng quan và bản đồ phụ; chấp nhận chưa đối chiếu biên giới với VNSDI (Điều 19).',
    },
  },
  {
    id: 'vietmap',
    sovereigntyLabels: false,
    name: 'VIETMAP Tilemap',
    url: 'api:/map/vietmap/styles/{style}/style.json',
    sourceType: 'maplibre-style',
    attribution: '<a href="https://maps.vietmap.vn/" target="_blank" rel="noopener noreferrer">© Vietmap</a>',
    license: 'Thương mại, theo hợp đồng/gói VIETMAP; khóa "public tile" tách khỏi khóa backend.',
    modes: ['street', 'dark', 'satellite'],
    status: 'TESTING',
    dataSource: 'VIETMAP',
    lastVerified: '2026-11-26',
    version: 'styles tm/lm/dm/hm + raster st',
    evidence: [
      'Style tm, dm, hm: HTTP 200 qua proxy API.',
      'Mọi ô vector và raster: HTTP 423 "Your request is limited".',
      'Theo tài liệu VIETMAP, 423 = hết hạn mức HOẶC API Tile chưa bật cho khóa (khóa dùng thử mặc định tắt Tile).',
      'Map Editor: đường ranh giới chủ quyền chỉ đổi được màu, không ẩn/làm mờ được.',
    ],
    blockers: [
      'Khóa hiện tại không tải được ô bản đồ: cần bật Tile hoặc tạo khóa "public tile" trên console VIETMAP.',
      'Chưa quét được tên địa danh trong ô vector (bị 423).',
    ],
  },
  {
    id: 'openmap',
    sovereigntyLabels: false,
    name: 'OpenMap.vn (nay chuyển hướng ndamaps.vn)',
    url: 'https://maptiles.openmap.vn/styles/{day-v1|night-v1|satellite-v1}/style.json?apikey=…',
    sourceType: 'maplibre-style',
    attribution: 'Chưa xác định',
    license: 'Chưa tìm thấy điều khoản; bắt buộc khóa API.',
    modes: [],
    status: 'BLOCKED',
    dataSource: 'Chưa xác định',
    lastVerified: '2026-11-26',
    version: '-',
    evidence: ['Tài liệu: 3 style day/night/satellite, tương thích MapLibre, bắt buộc apikey.'],
    blockers: [
      'Cần tài khoản enterprise.openmap.vn để lấy khóa; chưa có thông tin chủ quyền, nguồn dữ liệu, hạn mức.',
    ],
  },
  {
    id: 'ekmap',
    sovereigntyLabels: false,
    name: 'eKMap Platform (ekgis.vn)',
    url: '-',
    sourceType: 'maplibre-style',
    attribution: 'Chưa xác định',
    license: 'Chưa xác định',
    modes: [],
    status: 'BLOCKED',
    dataSource: 'Chưa xác định',
    lastVerified: '2026-11-26',
    version: '-',
    evidence: [
      'docs.ekgis.vn và ekgis.vn: không phân giải được tên miền / không kết nối được từ môi trường kiểm thử.',
    ],
    blockers: ['Không truy cập được tài liệu và dịch vụ.'],
  },
  {
    id: 'mapslibvn',
    sovereigntyLabels: false,
    name: 'MapsLibVN',
    url: '-',
    sourceType: 'pmtiles',
    attribution: 'Chưa xác định',
    license: 'Chưa xác định',
    modes: [],
    status: 'BLOCKED',
    dataSource: 'Chưa xác định',
    lastVerified: '2026-11-26',
    version: '-',
    evidence: ['mapslibvn.pages.dev: không phân giải được tên miền; tìm kiếm web không thấy dự án.'],
    blockers: ['Không truy cập được.'],
  },
  {
    id: 'osm-standard',
    sovereigntyLabels: false,
    name: 'OpenStreetMap Standard tiles',
    url: '-',
    sourceType: 'xyz-raster',
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL 1.0',
    modes: [],
    status: 'REJECTED',
    dataSource: 'OpenStreetMap',
    lastVerified: '2026-11-26',
    version: '-',
    evidence: ['Đã gỡ khỏi hiển thị theo yêu cầu: không dùng làm nền mặc định hay dự phòng.'],
    blockers: ['Không dùng làm nguồn chủ quyền.'],
  },
];

/** Production chỉ nhận APPROVED; dev/kiểm thử nhận thêm TESTING (để thu thập bằng chứng, không phát hành). */
export function allowedStatuses(production: boolean): VerificationStatus[] {
  return production ? ['APPROVED'] : ['APPROVED', 'TESTING'];
}

export function isUsable(provider: BasemapProvider, production: boolean): boolean {
  if (!allowedStatuses(production).includes(provider.status)) return false;
  // APPROVED phải có người duyệt.
  return provider.status !== 'APPROVED' || Boolean(provider.approval);
}

export function providerById(id: string): BasemapProvider | undefined {
  return BASEMAP_PROVIDERS.find((provider) => provider.id === id);
}

/**
 * Thứ tự thử cho từng chế độ. Nguồn BLOCKED hôm nay (VNSDI) vẫn đứng đầu phần hành chính/tổng quan
 * vì là nguồn nhà nước: khi chủ dự án có token và duyệt, nó tự được dùng.
 */
export const MODE_CHAINS: Record<BasemapMode, string[]> = {
  street: ['vapp', 'vietmap'],
  dark: ['vietmap', 'vapp'],
  satellite: ['vnsdi-sentinel2', 'vietmap'],
  admin: ['vnsdi-admin', 'vapp'],
  terrain: ['vnsdi-terrain', 'vapp'],
  overview: ['vnsdi-admin', 'vapp'],
};

/** Tên ngắn của đơn vị cung cấp, theo tiền tố id (vnsdi-admin, vnsdi-sentinel2… đều là VNSDI). */
const SOURCE_CREDITS: Record<string, string> = {
  vapp: 'vApp (map.vapp.vn)',
  vietmap: 'Vietmap',
  vnsdi: 'VNSDI',
};

/**
 * Các đơn vị có nguồn nền thực sự dùng được trong bản build này (production: chỉ nguồn đã duyệt).
 * Dùng cho dòng "Nguồn" trong giao diện, để không ghi tên nguồn chưa được dùng.
 */
export function usableSourceCredits(production: boolean): string[] {
  const credits = BASEMAP_PROVIDERS.filter((provider) => isUsable(provider, production)).map(
    (provider) => SOURCE_CREDITS[provider.id.split('-')[0] ?? ''] ?? provider.name,
  );
  return [...new Set(credits)];
}

export function usableChain(mode: BasemapMode, production: boolean): BasemapProvider[] {
  return MODE_CHAINS[mode]
    .map(providerById)
    .filter((p): p is BasemapProvider => Boolean(p && isUsable(p, production) && p.modes.includes(mode)));
}
