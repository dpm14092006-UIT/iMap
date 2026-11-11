import type {
  TrafficReportBounds,
  TrafficImageAnalysisDto,
  TrafficImageAnalysisTask,
  TrafficReportDto,
  TrafficReportInput,
} from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';
import { getSupabaseClient } from '../../auth/services/supabaseClient';

export const vietnamBounds: TrafficReportBounds = { minLat: 7, minLng: 102, maxLat: 24, maxLng: 117 };
const photoExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const maxPhotoBytes = 5 * 1024 * 1024;

function boundsQuery(bounds: TrafficReportBounds) {
  const query = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
  return query.toString();
}

export const trafficApi = {
  imageAnalysisReady: () => apiRequest<{ configured?: { trafficImageAi?: boolean } }>('/health'),
  list: (accessToken?: string, bounds: TrafficReportBounds = vietnamBounds) =>
    apiRequest<TrafficReportDto[]>(`/traffic-reports?${boundsQuery(bounds)}`, undefined, accessToken),
  create: (input: TrafficReportInput, accessToken: string) =>
    apiRequest<TrafficReportDto>(
      '/traffic-reports',
      { method: 'POST', body: JSON.stringify(input) },
      accessToken,
    ),
  analyzeImage: (file: File, task: TrafficImageAnalysisTask, accessToken: string) =>
    apiRequest<TrafficImageAnalysisDto>(
      `/traffic-reports/analyze-image?task=${task}`,
      { method: 'POST', headers: { 'Content-Type': file.type }, body: file },
      accessToken,
    ),
  clearance: (id: string, state: 'clear' | 'still_active', accessToken: string) =>
    apiRequest<TrafficReportDto>(
      `/traffic-reports/${id}/clearance`,
      { method: 'POST', body: JSON.stringify({ state }) },
      accessToken,
    ),
  uploadPhoto: async (file: File, userId: string): Promise<string> => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Cần cấu hình Supabase để đính kèm ảnh.');
    if (!photoExtensions[file.type] || file.size > maxPhotoBytes)
      throw new Error('Ảnh phải là JPG, PNG hoặc WebP và không quá 5 MB.');
    const path = `${userId}/traffic-reports/${crypto.randomUUID()}.${photoExtensions[file.type]}`;
    const { error } = await client.storage.from('traffic-images').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error('Không tải được ảnh lên. Kiểm tra kết nối và quyền lưu trữ.');
    return path;
  },
  removePhoto: async (path: string): Promise<void> => {
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client.storage.from('traffic-images').remove([path]);
    if (error) throw new Error('Không thể dọn ảnh chưa gắn với báo cáo.');
  },
  signedPhotoUrl: async (path: string): Promise<string | null> => {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.storage.from('traffic-images').createSignedUrl(path, 600);
    return error ? null : data.signedUrl;
  },
};
