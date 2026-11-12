import { useEffect, useState } from 'react';
import type {
  TrafficImageAnalysisDto,
  TrafficImageAnalysisTask,
  TrafficVehicleScope,
} from '@routetwin/shared';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import { trafficApi, trafficPhotos } from '../api/trafficApi';
import { incidentLabels } from '../services/trafficPresentation';

export type IncidentKind =
  'traffic_jam' | 'accident' | 'construction' | 'flood' | 'road_closure' | 'obstacle';
export type IncidentSeverity = 'low' | 'medium' | 'high';
export type { TrafficVehicleScope };
export type DemoIncident = {
  id: string;
  type: IncidentKind;
  severity: IncidentSeverity;
  vehicleScope: TrafficVehicleScope;
  description: string;
  time: string;
  lat: number;
  lng: number;
  imagePath?: string;
  status?: 'active' | 'cleared' | 'expired';
  communityReportCount?: number;
  communityReporterCount?: number;
  communityUpdatedAt?: string;
};

const incidentOptions: {
  id: IncidentKind;
  label: string;
  icon: 'traffic' | 'car' | 'road' | 'globe' | 'close-circle' | 'layers';
}[] = [
  { id: 'traffic_jam', label: incidentLabels.traffic_jam, icon: 'traffic' },
  { id: 'accident', label: incidentLabels.accident, icon: 'car' },
  { id: 'construction', label: incidentLabels.construction, icon: 'road' },
  { id: 'flood', label: incidentLabels.flood, icon: 'globe' },
  { id: 'road_closure', label: incidentLabels.road_closure, icon: 'close-circle' },
  { id: 'obstacle', label: incidentLabels.obstacle, icon: 'layers' },
];

const severityOptions: { id: IncidentSeverity; label: string; color: string }[] = [
  { id: 'low', label: 'Nhẹ', color: 'bg-emerald-500' },
  { id: 'medium', label: 'Vừa', color: 'bg-amber-500' },
  { id: 'high', label: 'Nặng', color: 'bg-red-500' },
];

type TrafficReportPanelProps = {
  incidents: DemoIncident[];
  selectedPoint: { lat: number; lng: number } | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  defaultVehicle: Exclude<TrafficVehicleScope, 'both'>;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSignIn: () => void;
  onReport: (
    type: IncidentKind,
    severity: IncidentSeverity,
    vehicleScope: TrafficVehicleScope,
    point: { lat: number; lng: number },
    note: string,
    photo: File | null,
  ) => Promise<void>;
  onClearance: (id: string, state: 'clear' | 'still_active') => Promise<void>;
};

export function TrafficReportPanel({
  incidents,
  selectedPoint,
  isAuthenticated,
  accessToken,
  defaultVehicle,
  loading,
  error,
  onClose,
  onSignIn,
  onReport,
  onClearance,
}: TrafficReportPanelProps) {
  const [type, setType] = useState<IncidentKind>('traffic_jam');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [vehicleScope, setVehicleScope] = useState<TrafficVehicleScope>(defaultVehicle);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [imageAnalysis, setImageAnalysis] = useState<TrafficImageAnalysisDto | null>(null);
  const [analysisTask, setAnalysisTask] = useState<TrafficImageAnalysisTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyReportId, setBusyReportId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => setVehicleScope(defaultVehicle), [defaultVehicle]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    let current = true;
    const recentPhotos = incidents.slice(0, 8).filter((incident) => incident.imagePath);
    if (!recentPhotos.length) {
      setPhotoUrls({});
      return () => {
        current = false;
      };
    }
    void Promise.all(
      recentPhotos.map(
        async (incident) => [incident.id, await trafficPhotos.signedUrl(incident.imagePath!)] as const,
      ),
    )
      .then((entries) => {
        if (current)
          setPhotoUrls(
            Object.fromEntries(
              entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
            ),
          );
      })
      .catch(() => {
        if (current) setPhotoUrls({});
      });
    return () => {
      current = false;
    };
  }, [incidents]);

  useEffect(() => {
    let current = true;
    void trafficApi
      .imageAnalysisReady()
      .then((status) => {
        if (current) setAiStatus(status.configured?.trafficImageAi ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (current) setAiStatus('unavailable');
      });
    return () => {
      current = false;
    };
  }, []);

  const selectPhoto = (file: File | undefined) => {
    if (!file) return;
    setActionMessage('');
    setActionError('');
    setImageAnalysis(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setActionError('Ảnh phải có định dạng JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionError('Ảnh tối đa 5 MB.');
      return;
    }
    setPhoto(file);
  };

  const analyzePhoto = async (task: TrafficImageAnalysisTask) => {
    if (!photo) return;
    if (!accessToken) {
      onSignIn();
      setActionError('Đăng nhập để dùng phân tích ảnh.');
      return;
    }
    setAnalysisTask(task);
    setActionError('');
    setActionMessage('');
    try {
      setImageAnalysis(await trafficApi.analyzeImage(photo, task, accessToken));
    } catch (cause) {
      setImageAnalysis(null);
      setActionError(cause instanceof Error ? cause.message : 'Không phân tích được ảnh.');
    } finally {
      setAnalysisTask(null);
    }
  };

  const applyIncidentSuggestion = () => {
    if (!imageAnalysis || imageAnalysis.task !== 'incident' || !imageAnalysis.trafficRelated) return;
    if (imageAnalysis.incidentType !== 'unknown') setType(imageAnalysis.incidentType);
    setNote(imageAnalysis.summary);
    setActionMessage('Đã điền loại sự cố và ghi chú. Mức độ vẫn theo lựa chọn thủ công của bạn.');
  };

  const submit = async () => {
    if (!selectedPoint || !isAuthenticated) return;
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await onReport(type, severity, vehicleScope, selectedPoint, note.trim(), photo);
      setNote('');
      setPhoto(null);
      setImageAnalysis(null);
      setActionMessage('Đã gửi báo cáo. Cảm ơn bạn đã cập nhật tình hình.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không gửi được báo cáo.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (id: string, state: 'clear' | 'still_active') => {
    setBusyReportId(id);
    setActionError('');
    setActionMessage('');
    try {
      await onClearance(id, state);
      setActionMessage(
        state === 'clear' ? 'Đã xác nhận tình hình đã thông thoáng.' : 'Đã xác nhận sự cố vẫn còn.',
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không cập nhật được xác minh.');
    } finally {
      setBusyReportId('');
    }
  };

  return (
    <FloatingPanel eyebrow="CỘNG ĐỒNG" title="Tình hình giao thông" icon="traffic" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Cảnh báo cộng đồng
        </span>
        <span className="text-[10px] font-medium text-slate-500">Tự hết hạn</span>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-end justify-between gap-2">
          <h3 className="text-[12px] font-bold text-ink">Báo cáo sự cố</h3>
          <span className="text-right text-[10px] text-slate-400">
            {selectedPoint
              ? `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}`
              : 'Chạm bản đồ để chọn vị trí'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {incidentOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={type === item.id}
              onClick={() => setType(item.id)}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold transition ${type === item.id ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600">Mức độ sự cố · chọn thủ công</span>
        <div className="flex gap-1">
          {severityOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={severity === item.id}
              onClick={() => setSeverity(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition ${severity === item.id ? 'bg-slate-100 text-ink' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <div className="mb-1.5 text-[10px] font-semibold text-slate-600">Áp dụng cho loại xe</div>
        <div
          className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
          role="group"
          aria-label="Loại xe áp dụng báo cáo"
        >
          {(
            [
              ['motorcycle', 'Xe máy'],
              ['car', 'Ô tô'],
              ['both', 'Cả hai'],
            ] as const
          ).map(([scope, label]) => (
            <button
              key={scope}
              type="button"
              aria-pressed={vehicleScope === scope}
              onClick={() => setVehicleScope(scope)}
              className={`rounded-md px-1.5 py-1.5 text-[9px] font-semibold transition ${vehicleScope === scope ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="mb-3 block text-[10px] font-semibold text-slate-600">
        Ghi chú ngắn <span className="font-normal text-slate-400">(không bắt buộc)</span>
        <textarea
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Ví dụ: ngập sâu gần giao lộ…"
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-normal text-ink outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-50"
        />
      </label>
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-700">
            Ảnh hiện trường <span className="font-normal text-slate-400">(không bắt buộc)</span>
          </span>
          <span className="text-[9px] text-slate-400">Tối đa 5 MB</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-100 focus-within:ring-4 focus-within:ring-brand-100">
            <Icon name="camera" size={15} />
            Chụp ảnh
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={Boolean(analysisTask) || busy}
              className="sr-only"
              onChange={(event) => {
                selectPhoto(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 focus-within:ring-4 focus-within:ring-slate-200">
            <Icon name="upload" size={14} />
            Chọn ảnh
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={Boolean(analysisTask) || busy}
              className="sr-only"
              onChange={(event) => {
                selectPhoto(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-[9px] leading-4 text-slate-400">
          Trên điện thoại, nút Chụp ảnh sẽ mở camera. Ảnh chỉ được lưu cùng báo cáo khi bạn bấm Gửi báo cáo.
        </p>
        {photo && photoPreview && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2">
            <img
              src={photoPreview}
              alt="Xem trước ảnh hiện trường"
              className="h-16 w-20 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{photo.name}</span>
            <button
              type="button"
              aria-label="Xóa ảnh đã chọn"
              disabled={busy || Boolean(analysisTask)}
              onClick={() => {
                setPhoto(null);
                setImageAnalysis(null);
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-50"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        )}
        {photo && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[10px] font-semibold text-slate-700">
              Hỗ trợ từ AI <span className="font-normal text-slate-400">(tùy chọn)</span>
            </p>
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-busy={analysisTask === 'incident'}
                  disabled={Boolean(analysisTask) || busy || aiStatus !== 'ready'}
                  onClick={() => void analyzePhoto('incident')}
                  className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2 text-[10px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                >
                  {analysisTask === 'incident' ? 'Đang phân tích…' : 'Gợi ý loại sự cố'}
                </button>
                <button
                  type="button"
                  aria-busy={analysisTask === 'traffic_sign'}
                  disabled={Boolean(analysisTask) || busy || aiStatus !== 'ready'}
                  onClick={() => void analyzePhoto('traffic_sign')}
                  className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {analysisTask === 'traffic_sign' ? 'Đang nhận diện…' : 'Nhận diện biển báo'}
                </button>
              </div>
              {aiStatus === 'ready' ? (
                <p className="mt-2 text-[9px] leading-4 text-slate-500">
                  Ảnh chỉ được gửi đến Google Gemini khi bạn bấm một nút trên. Với gói miễn phí, Google có thể
                  dùng nội dung để cải thiện dịch vụ và người đánh giá có thể xem. Tránh ảnh có khuôn mặt hoặc
                  biển số.
                </p>
              ) : (
                <p className="mt-2 text-[9px] leading-4 text-slate-500">
                  {aiStatus === 'checking'
                    ? 'Đang kiểm tra cấu hình Gemini…'
                    : aiStatus === 'unavailable'
                      ? 'AI ảnh chưa bật trên backend. Cần GEMINI_TRAFFIC_AI_ENABLED=true và GEMINI_API_KEY.'
                      : 'Đăng nhập để sử dụng gợi ý AI.'}
                </p>
              )}
            </>
            {analysisTask && (
              <p className="mt-2 text-[10px] text-brand-700" role="status">
                Đang phân tích ảnh…
              </p>
            )}
            {imageAnalysis?.task === 'incident' && (
              <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/70 p-3" role="status">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-brand-800">Gợi ý sự cố</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                    Tin cậy:{' '}
                    {imageAnalysis.confidence === 'high'
                      ? 'cao'
                      : imageAnalysis.confidence === 'medium'
                        ? 'vừa'
                        : 'thấp'}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-slate-700">{imageAnalysis.summary}</p>
                {imageAnalysis.evidence.length > 0 && (
                  <p className="mt-1 text-[9px] leading-4 text-slate-500">
                    Quan sát: {imageAnalysis.evidence.join(' · ')}
                  </p>
                )}
                {!imageAnalysis.trafficRelated && (
                  <p className="mt-1 text-[9px] font-medium text-amber-700">
                    Ảnh chưa đủ căn cứ để xác định sự cố giao thông.
                  </p>
                )}
                <p className="mt-1 text-[9px] text-slate-500">
                  AI chỉ gợi ý loại sự cố và ghi chú. Mức độ do bạn tự chọn.
                </p>
                <button
                  type="button"
                  disabled={!imageAnalysis.trafficRelated}
                  onClick={applyIncidentSuggestion}
                  className="mt-2 min-h-8 rounded-lg bg-white px-3 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Dùng gợi ý để điền form
                </button>
              </div>
            )}
            {imageAnalysis?.task === 'traffic_sign' && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" role="status">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-800">Nhận diện biển báo</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                    Tin cậy:{' '}
                    {imageAnalysis.confidence === 'high'
                      ? 'cao'
                      : imageAnalysis.confidence === 'medium'
                        ? 'vừa'
                        : 'thấp'}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-slate-700">
                  {imageAnalysis.trafficSign ? imageAnalysis.label : 'Chưa nhận diện được biển báo rõ ràng'}
                </p>
                {imageAnalysis.visibleText && (
                  <p className="mt-1 text-[9px] text-slate-500">
                    Chữ/số nhìn thấy: {imageAnalysis.visibleText}
                  </p>
                )}
                <p className="mt-1 text-[9px] leading-4 text-amber-700">
                  Chỉ là gợi ý hình ảnh; hiệu lực còn phụ thuộc chiều đường và biển phụ. Không tự thay đổi
                  tuyến đường.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {isAuthenticated ? (
        <button
          type="button"
          disabled={!selectedPoint || busy || Boolean(analysisTask)}
          onClick={() => void submit()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Icon name="send" size={16} />
          {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700"
        >
          <Icon name="pin" size={16} />
          Đăng nhập để gửi báo cáo
        </button>
      )}
      {!selectedPoint && (
        <p className="mt-2 text-center text-[10px] text-slate-500">
          Chọn đúng vị trí trên bản đồ trước khi gửi.
        </p>
      )}
      {actionMessage && (
        <p className="mt-2 text-[10px] font-medium text-emerald-700" role="status">
          {actionMessage}
        </p>
      )}
      {(actionError || error) && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-700" role="alert">
          {actionError || error}
        </p>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[12px] font-bold text-ink">Báo cáo gần đây</h3>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
            {incidents.length}
          </span>
        </div>
        {loading && (
          <p className="mb-2 text-[10px] text-slate-500" role="status">
            Đang đồng bộ báo cáo…
          </p>
        )}
        {incidents.length ? (
          <ul className="space-y-2">
            {incidents.slice(0, 8).map((incident) => {
              const selectedType = incidentOptions.find((option) => option.id === incident.type);
              const selectedSeverity = severityOptions.find((option) => option.id === incident.severity);
              return (
                <li key={incident.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${selectedSeverity?.color ?? 'bg-slate-400'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-ink">
                        {selectedType?.label ?? 'Sự cố'} · {incident.description}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {incident.time} ·{' '}
                        {incident.vehicleScope === 'both'
                          ? 'Ô tô + xe máy'
                          : incident.vehicleScope === 'car'
                            ? 'Ô tô'
                            : 'Xe máy'}{' '}
                        · {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 pl-4 text-[9px] font-medium text-brand-700">
                    {incident.communityReportCount ?? 1} báo cáo trong 30 phút / 75 m ·{' '}
                    {incident.communityReporterCount ?? 0} người gửi riêng biệt
                    {incident.communityUpdatedAt
                      ? ` · cập nhật ${new Date(incident.communityUpdatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                      : ' · chưa có xác nhận mới'}
                  </p>
                  {incident.imagePath && photoUrls[incident.id] && (
                    <a
                      href={photoUrls[incident.id]}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Mở ảnh minh chứng"
                      className="mt-2 block overflow-hidden rounded-lg"
                    >
                      <img
                        src={photoUrls[incident.id]}
                        alt={`Ảnh minh chứng: ${selectedType?.label ?? 'sự cố giao thông'}`}
                        loading="lazy"
                        className="max-h-36 w-full rounded-lg object-cover"
                      />
                    </a>
                  )}
                  {incident.imagePath && !photoUrls[incident.id] && (
                    <p className="mt-1.5 pl-4 text-[9px] text-slate-500">Có ảnh minh chứng</p>
                  )}
                  {isAuthenticated && (
                    <div className="mt-2 flex gap-2 pl-4">
                      <button
                        type="button"
                        disabled={busyReportId === incident.id}
                        onClick={() => void verify(incident.id, 'clear')}
                        className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Đã thông
                      </button>
                      <button
                        type="button"
                        disabled={busyReportId === incident.id}
                        onClick={() => void verify(incident.id, 'still_active')}
                        className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Vẫn còn
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : !loading && !error ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] leading-5 text-slate-500">
            Chưa có báo cáo trong khu vực này. Hãy chọn vị trí và gửi cập nhật đầu tiên.
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-[10px] leading-4 text-slate-500">
        Báo cáo được đồng bộ qua Supabase và tự ẩn khi hết hạn. Hãy tự xác minh tình hình trước khi di chuyển.
      </p>
    </FloatingPanel>
  );
}
