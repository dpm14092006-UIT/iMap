import type {
  TrafficImageAnalysisDto,
  TrafficImageAnalysisTask,
  TrafficReportBounds,
  TrafficReportDto,
  TrafficReportInput,
} from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';
import { getSupabaseClient } from '../../auth/services/supabaseClient';

export const vietnamBounds: TrafficReportBounds = { minLat: 7, minLng: 102, maxLat: 24, maxLng: 117 };

/** Client gọi module `traffic-reports` của backend. */
export class TrafficApiClient {
  constructor(private readonly http: HttpClient) {}

  /** Backend báo AI phân tích ảnh đã được cấu hình hay chưa. */
  imageAnalysisReady() {
    return this.http.get<{ configured?: { trafficImageAi?: boolean } }>('/health');
  }

  list(accessToken?: string, bounds: TrafficReportBounds = vietnamBounds) {
    const query = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
    return this.http.get<TrafficReportDto[]>(`/traffic-reports?${query}`, { accessToken });
  }

  create(input: TrafficReportInput, accessToken: string) {
    return this.http.post<TrafficReportDto>('/traffic-reports', input, { accessToken });
  }

  analyzeImage(file: File, task: TrafficImageAnalysisTask, accessToken: string) {
    return this.http.post<TrafficImageAnalysisDto>(`/traffic-reports/analyze-image?task=${task}`, file, {
      accessToken,
      headers: { 'Content-Type': file.type },
    });
  }

  clearance(id: string, state: 'clear' | 'still_active', accessToken: string) {
    return this.http.post<TrafficReportDto>(`/traffic-reports/${id}/clearance`, { state }, { accessToken });
  }
}

const photoExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_BUCKET = 'traffic-images';

/** Ảnh minh chứng nằm trong bucket riêng tư của Supabase; người dùng chỉ ghi được vào thư mục của mình. */
export class TrafficPhotoStorage {
  async upload(file: File, userId: string): Promise<string> {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Cần cấu hình Supabase để đính kèm ảnh.');
    if (!photoExtensions[file.type] || file.size > MAX_PHOTO_BYTES) {
      throw new Error('Ảnh phải là JPG, PNG hoặc WebP và không quá 5 MB.');
    }
    const path = `${userId}/traffic-reports/${crypto.randomUUID()}.${photoExtensions[file.type]}`;
    const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error('Không tải được ảnh lên. Kiểm tra kết nối và quyền lưu trữ.');
    return path;
  }

  async remove(path: string): Promise<void> {
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) throw new Error('Không thể dọn ảnh chưa gắn với báo cáo.');
  }

  /** Link tạm (10 phút) để xem ảnh; null nếu không lấy được. */
  async signedUrl(path: string): Promise<string | null> {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, 600);
    return error ? null : data.signedUrl;
  }
}

export const trafficApi = new TrafficApiClient(httpClient);
export const trafficPhotos = new TrafficPhotoStorage();
