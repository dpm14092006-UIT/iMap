import { useCallback, useEffect, useState } from 'react';
import { trafficImageAnalysisSchema, trafficSignRecognitionSchema, type AiAnalysisDto } from '@routetwin/shared';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import { useAuth } from '../../auth/context/AuthProvider';
import { aiVisionApi } from '../api/aiVisionApi';

type AiVisionPanelProps = { onClose: () => void; onRequireAuth: () => void };
type AiTaskMode = 'traffic_analysis' | 'sign_recognition';

const resultLabels: Record<string, string> = {
  visible_incident: 'Có dấu hiệu sự cố',
  no_obvious_incident: 'Chưa thấy sự cố rõ ràng',
  unclear: 'Ảnh chưa đủ rõ',
  traffic_jam: 'Kẹt xe', accident: 'Tai nạn', construction: 'Thi công', flood: 'Ngập đường', road_closure: 'Đường đóng', obstacle: 'Vật cản',
  prohibition: 'Cấm', warning: 'Cảnh báo', mandatory: 'Hiệu lệnh', guide: 'Chỉ dẫn', other: 'Khác', unknown: 'Chưa xác định',
  true: 'Có nhận diện', false: 'Chưa nhận diện',
};

function displayResult(value: string | number | boolean | null) {
  if (value === null) return 'Chưa xác định';
  if (typeof value === 'boolean') return resultLabels[String(value)];
  if (typeof value === 'number' && value <= 1) return `${Math.round(value * 100)}%`;
  return resultLabels[String(value)] ?? String(value);
}

export function AiVisionPanel({ onClose, onRequireAuth }: AiVisionPanelProps) {
  const { accessToken } = useAuth();
  const [mode, setMode] = useState<AiTaskMode>('traffic_analysis');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiAnalysisDto | null>(null);
  const [history, setHistory] = useState<AiAnalysisDto[]>([]);
  const [historyError, setHistoryError] = useState('');

  const loadHistory = useCallback(async () => {
    if (!accessToken) { setHistory([]); return; }
    try {
      setHistory(await aiVisionApi.history(accessToken));
      setHistoryError('');
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Không tải được lịch sử phân tích.');
    }
  }, [accessToken]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async () => {
    if (!file) return;
    if (!accessToken) { onRequireAuth(); return; }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = mode === 'traffic_analysis'
        ? await aiVisionApi.analyzeTraffic(file, accessToken)
        : await aiVisionApi.recognizeSign(file, accessToken);
      setResult(response);
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể phân tích ảnh lúc này.');
    } finally {
      setBusy(false);
    }
  };

  const traffic = result?.task === 'traffic_analysis' ? trafficImageAnalysisSchema.safeParse(result.result).data : undefined;
  const sign = result?.task === 'sign_recognition' ? trafficSignRecognitionSchema.safeParse(result.result).data : undefined;
  const resultEntries = traffic ? Object.entries(traffic) : sign ? Object.entries(sign) : [];

  return (
    <FloatingPanel eyebrow="AI VISION" title="Phân tích ảnh giao thông" icon="sparkles" onClose={onClose}>
      <p className="mb-4 text-[11px] leading-5 text-slate-500">AI chỉ mô tả dấu hiệu nhìn thấy trong ảnh. Hãy tự xác minh trước khi báo cáo hoặc thay đổi lộ trình.</p>
      <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Chọn loại phân tích">
        <button type="button" aria-pressed={mode === 'traffic_analysis'} onClick={() => { setMode('traffic_analysis'); setResult(null); }} className={`rounded-lg px-2 py-2 text-[10px] font-bold transition ${mode === 'traffic_analysis' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>Tình hình giao thông</button>
        <button type="button" aria-pressed={mode === 'sign_recognition'} onClick={() => { setMode('sign_recognition'); setResult(null); }} className={`rounded-lg px-2 py-2 text-[10px] font-bold transition ${mode === 'sign_recognition' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>Nhận diện biển báo</button>
      </div>
      <label htmlFor="traffic-image" className="group block cursor-pointer rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-center transition hover:border-brand-400 hover:bg-brand-50">
        {previewUrl ? <img src={previewUrl} alt="Ảnh được chọn để phân tích" className="mx-auto max-h-48 w-full rounded-xl object-contain" /> : <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm"><Icon name="upload" size={23} /></span>}
        <span className="mt-3 block break-all text-[11px] font-bold text-ink">{file ? file.name : 'Chọn ảnh từ thiết bị'}</span>
        <span className="mt-1 block text-[10px] text-slate-500">JPG, PNG hoặc WebP · tối đa 5 MB</span>
        <input id="traffic-image" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null;
          setResult(null);
          if (nextFile && !['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
            setFile(null); setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
          } else if (nextFile && nextFile.size > 5 * 1024 * 1024) {
            setFile(null); setError('Ảnh vượt giới hạn 5 MB. Hãy chọn ảnh nhỏ hơn.');
          } else {
            setFile(nextFile); setError('');
          }
          event.currentTarget.value = '';
        }} />
      </label>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-700" role="alert">{error}</p>}
      <button type="button" disabled={!file || busy} onClick={() => void submit()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700 disabled:bg-slate-300"><Icon name="sparkles" size={17} />{busy ? 'Đang phân tích ảnh…' : accessToken ? 'Phân tích ảnh' : 'Đăng nhập để phân tích'}</button>
      {result && <section className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3" aria-label="Kết quả phân tích">
        <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[11px] font-bold text-ink">Kết quả tham khảo</h3><span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-slate-500">{result.model}</span></div>
        <dl className="space-y-2">{resultEntries.map(([key, value]) => <div key={key} className="flex items-start justify-between gap-4 border-b border-brand-100/70 pb-1.5 last:border-0"><dt className="text-[10px] capitalize text-slate-500">{key === 'incidentType' ? 'Loại sự cố' : key === 'description' ? 'Mô tả' : key === 'confidence' ? 'Độ tin cậy' : key === 'evidence' ? 'Dấu hiệu' : key === 'recognized' ? 'Nhận diện' : key === 'category' ? 'Nhóm biển báo' : key === 'text' ? 'Chữ trên biển' : 'Tình trạng'}</dt><dd className="max-w-[65%] text-right text-[10px] font-semibold leading-4 text-ink">{displayResult(value as string | number | boolean | null)}</dd></div>)}</dl>
        <p className="mt-2 text-[9px] text-slate-500">Phân tích lúc {new Date(result.processedAt).toLocaleString('vi-VN')} · Kết quả đã lưu vào tài khoản.</p>
      </section>}
      {accessToken && <section className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-bold text-ink">Phân tích gần đây</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{history.length}</span></div>
        {historyError && <p className="text-[10px] text-slate-500" role="status">{historyError}</p>}
        {history.length > 0 && <ul className="space-y-1.5">{history.map((item) => <li key={item.id ?? `${item.task}-${item.processedAt}`}>
          <button type="button" onClick={() => { setMode(item.task); setResult(item); }} className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-left transition hover:bg-brand-50"><span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-ink">{item.task === 'traffic_analysis' ? 'Tình hình giao thông' : 'Nhận diện biển báo'}</span><span className="block text-[9px] text-slate-500">{new Date(item.processedAt).toLocaleString('vi-VN')}</span></span><Icon name="chevron-down" size={13} className="-rotate-90 shrink-0 text-slate-400" /></button>
        </li>)}</ul>}
        {!history.length && !historyError && <p className="text-[10px] text-slate-500">Chưa có kết quả đã lưu.</p>}
      </section>}
      <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">Ảnh được lưu riêng tư trong tài khoản cùng với kết quả phân tích; chỉ chủ tài khoản có quyền đọc ảnh.</p>
    </FloatingPanel>
  );
}
