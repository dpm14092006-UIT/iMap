import { useEffect, useState } from 'react';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import { trafficApi } from '../api/trafficApi';

export type IncidentKind = 'traffic_jam' | 'accident' | 'construction' | 'flood' | 'road_closure' | 'obstacle';
export type IncidentSeverity = 'low' | 'medium' | 'high';
export type DemoIncident = {
  id: string; type: IncidentKind; severity: IncidentSeverity; description: string; time: string;
  lat: number; lng: number; imagePath?: string; status?: 'active' | 'cleared' | 'expired';
};

const incidentOptions: { id: IncidentKind; label: string; icon: 'traffic' | 'car' | 'road' | 'globe' | 'close-circle' | 'layers' }[] = [
  { id: 'traffic_jam', label: 'Kẹt xe', icon: 'traffic' },
  { id: 'accident', label: 'Tai nạn', icon: 'car' },
  { id: 'construction', label: 'Thi công', icon: 'road' },
  { id: 'flood', label: 'Ngập đường', icon: 'globe' },
  { id: 'road_closure', label: 'Đường đóng', icon: 'close-circle' },
  { id: 'obstacle', label: 'Vật cản', icon: 'layers' },
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
  loading: boolean;
  error: string;
  onClose: () => void;
  onSignIn: () => void;
  onReport: (type: IncidentKind, severity: IncidentSeverity, point: { lat: number; lng: number }, note: string, photo: File | null) => Promise<void>;
  onClearance: (id: string, state: 'clear' | 'still_active') => Promise<void>;
};

export function TrafficReportPanel({ incidents, selectedPoint, isAuthenticated, loading, error, onClose, onSignIn, onReport, onClearance }: TrafficReportPanelProps) {
  const [type, setType] = useState<IncidentKind>('traffic_jam');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [busyReportId, setBusyReportId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

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
      return () => { current = false; };
    }
    void Promise.all(recentPhotos.map(async (incident) => [
      incident.id,
      await trafficApi.signedPhotoUrl(incident.imagePath!),
    ] as const)).then((entries) => {
      if (current) setPhotoUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    });
    return () => { current = false; };
  }, [incidents]);

  const selectPhoto = (file: File | undefined) => {
    if (!file) return;
    setActionMessage('');
    setActionError('');
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

  const submit = async () => {
    if (!selectedPoint || !isAuthenticated) return;
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await onReport(type, severity, selectedPoint, note.trim(), photo);
      setNote('');
      setPhoto(null);
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
      setActionMessage(state === 'clear' ? 'Đã xác nhận tình hình đã thông thoáng.' : 'Đã xác nhận sự cố vẫn còn.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không cập nhật được xác minh.');
    } finally {
      setBusyReportId('');
    }
  };

  return (
    <FloatingPanel eyebrow="CỘNG ĐỒNG" title="Tình hình giao thông" icon="traffic" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Cảnh báo cộng đồng</span><span className="text-[10px] font-medium text-slate-500">Tự hết hạn</span></div>

      <div className="mb-4">
        <div className="mb-2 flex items-end justify-between gap-2"><h3 className="text-[12px] font-bold text-ink">Báo cáo sự cố</h3><span className="text-right text-[10px] text-slate-400">{selectedPoint ? `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}` : 'Chạm bản đồ để chọn vị trí'}</span></div>
        <div className="grid grid-cols-3 gap-2">
          {incidentOptions.map((item) => <button key={item.id} type="button" aria-pressed={type === item.id} onClick={() => setType(item.id)} className={`flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold transition ${type === item.id ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}><Icon name={item.icon} size={17} />{item.label}</button>)}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-600">Mức độ sự cố</span><div className="flex gap-1">
        {severityOptions.map((item) => <button key={item.id} type="button" aria-pressed={severity === item.id} onClick={() => setSeverity(item.id)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition ${severity === item.id ? 'bg-slate-100 text-ink' : 'text-slate-500 hover:bg-slate-50'}`}><span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />{item.label}</button>)}
      </div></div>
      <label className="mb-3 block text-[10px] font-semibold text-slate-600">Ghi chú ngắn <span className="font-normal text-slate-400">(không bắt buộc)</span>
        <textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Ví dụ: ngập sâu gần giao lộ…" className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-normal text-ink outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-50" />
      </label>
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-700">Ảnh hiện trường <span className="font-normal text-slate-400">(không bắt buộc)</span></span>
          <span className="text-[9px] text-slate-400">Tối đa 5 MB</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-100 focus-within:ring-4 focus-within:ring-brand-100">
            <Icon name="camera" size={15} />Chụp ảnh
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => { selectPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 focus-within:ring-4 focus-within:ring-slate-200">
            <Icon name="upload" size={14} />Chọn ảnh
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { selectPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
        </div>
        <p className="mt-2 text-[9px] leading-4 text-slate-400">Trên điện thoại, nút Chụp ảnh sẽ mở camera. Ảnh chỉ được tải lên khi bạn gửi báo cáo.</p>
        {photo && photoPreview && <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2">
          <img src={photoPreview} alt="Xem trước ảnh hiện trường" className="h-16 w-20 rounded-md object-cover" />
          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{photo.name}</span>
          <button type="button" aria-label="Xóa ảnh đã chọn" disabled={busy} onClick={() => setPhoto(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-50"><Icon name="trash" size={15} /></button>
        </div>}
      </div>
      {isAuthenticated ? <button type="button" disabled={!selectedPoint || busy} onClick={() => void submit()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Icon name="send" size={16} />{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</button> : <button type="button" onClick={onSignIn} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700"><Icon name="pin" size={16} />Đăng nhập để gửi báo cáo</button>}
      {!selectedPoint && <p className="mt-2 text-center text-[10px] text-slate-500">Chọn đúng vị trí trên bản đồ trước khi gửi.</p>}
      {actionMessage && <p className="mt-2 text-[10px] font-medium text-emerald-700" role="status">{actionMessage}</p>}
      {(actionError || error) && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-700" role="alert">{actionError || error}</p>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-bold text-ink">Báo cáo gần đây</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{incidents.length}</span></div>
        {loading && <p className="mb-2 text-[10px] text-slate-500" role="status">Đang đồng bộ báo cáo…</p>}
        {incidents.length ? <ul className="space-y-2">
          {incidents.slice(0, 8).map((incident) => {
            const selectedType = incidentOptions.find((option) => option.id === incident.type);
            const selectedSeverity = severityOptions.find((option) => option.id === incident.severity);
            return <li key={incident.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-2.5"><span className={`h-2 w-2 shrink-0 rounded-full ${selectedSeverity?.color ?? 'bg-slate-400'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-ink">{selectedType?.label ?? 'Sự cố'} · {incident.description}</span><span className="mt-0.5 block text-[10px] text-slate-500">{incident.time} · {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</span></span></div>
              {incident.imagePath && photoUrls[incident.id] && <a href={photoUrls[incident.id]} target="_blank" rel="noreferrer" aria-label="Mở ảnh minh chứng" className="mt-2 block overflow-hidden rounded-lg"><img src={photoUrls[incident.id]} alt={`Ảnh minh chứng: ${selectedType?.label ?? 'sự cố giao thông'}`} loading="lazy" className="max-h-36 w-full rounded-lg object-cover" /></a>}
              {incident.imagePath && !photoUrls[incident.id] && <p className="mt-1.5 pl-4 text-[9px] text-slate-500">Có ảnh minh chứng</p>}
              {isAuthenticated && <div className="mt-2 flex gap-2 pl-4"><button type="button" disabled={busyReportId === incident.id} onClick={() => void verify(incident.id, 'clear')} className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50 disabled:opacity-50">Đã thông</button><button type="button" disabled={busyReportId === incident.id} onClick={() => void verify(incident.id, 'still_active')} className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50">Vẫn còn</button></div>}
            </li>;
          })}
        </ul> : !loading && !error ? <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] leading-5 text-slate-500">Chưa có báo cáo trong khu vực này. Hãy chọn vị trí và gửi cập nhật đầu tiên.</p> : null}
      </div>
      <p className="mt-4 text-[10px] leading-4 text-slate-500">Báo cáo được đồng bộ qua Supabase và tự ẩn khi hết hạn. Hãy tự xác minh tình hình trước khi di chuyển.</p>
    </FloatingPanel>
  );
}
