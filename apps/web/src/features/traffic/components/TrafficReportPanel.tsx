import { useState } from 'react';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';

export type IncidentKind = 'traffic_jam' | 'accident' | 'construction' | 'flood' | 'road_closure' | 'obstacle';
export type IncidentSeverity = 'low' | 'medium' | 'high';
export type DemoIncident = { id: string; type: IncidentKind; severity: IncidentSeverity; description: string; time: string; lat: number; lng: number };

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

type TrafficReportPanelProps = { incidents: DemoIncident[]; selectedPoint: { lat: number; lng: number } | null; onClose: () => void; onReport: (type: IncidentKind, severity: IncidentSeverity, point: { lat: number; lng: number }) => void };

export function TrafficReportPanel({ incidents, selectedPoint, onClose, onReport }: TrafficReportPanelProps) {
  const [type, setType] = useState<IncidentKind>('traffic_jam');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [reported, setReported] = useState(false);

  return (
    <FloatingPanel eyebrow="CỘNG ĐỒNG" title="Tình hình giao thông" icon="traffic" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Cảnh báo cộng đồng</span><span className="text-[10px] font-medium text-slate-500">Chưa xác minh</span></div>

      <div className="mb-4">
        <div className="mb-2 flex items-end justify-between"><h3 className="text-[12px] font-bold text-ink">Báo cáo sự cố</h3><span className="text-[10px] text-slate-400">{selectedPoint ? 'Đã chọn vị trí' : 'Chạm bản đồ để chọn vị trí'}</span></div>
        <div className="grid grid-cols-3 gap-2">
          {incidentOptions.map((item) => <button key={item.id} type="button" aria-pressed={type === item.id} onClick={() => setType(item.id)} className={`flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold transition ${type === item.id ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}><Icon name={item.icon} size={17} />{item.label}</button>)}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-600">Mức độ sự cố</span><div className="flex gap-1">
        {severityOptions.map((item) => <button key={item.id} type="button" aria-pressed={severity === item.id} onClick={() => setSeverity(item.id)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition ${severity === item.id ? 'bg-slate-100 text-ink' : 'text-slate-500 hover:bg-slate-50'}`}><span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />{item.label}</button>)}
      </div></div>
      <button type="button" onClick={() => { onReport(type, severity, selectedPoint ?? { lat: 10.783, lng: 106.704 }); setReported(true); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700"><Icon name="send" size={16} />Gửi báo cáo</button>
      {reported && <p className="mt-2 text-[10px] font-medium text-emerald-700" role="status">Đã lưu báo cáo trên thiết bị này.</p>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-bold text-ink">Báo cáo gần đây</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{incidents.length}</span></div>
        {incidents.length ? <ul className="space-y-2">
          {incidents.map((incident) => {
            const selectedType = incidentOptions.find((option) => option.id === incident.type);
            const selectedSeverity = severityOptions.find((option) => option.id === incident.severity);
            return <li key={incident.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5"><span className={`h-2 w-2 shrink-0 rounded-full ${selectedSeverity?.color ?? 'bg-slate-400'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-ink">{selectedType?.label ?? 'Sự cố'} · {incident.description}</span><span className="mt-0.5 block text-[10px] text-slate-500">Chưa xác minh · {incident.time}</span></span><Icon name="chevron-down" size={14} className="-rotate-90 text-slate-400" /></li>;
          })}
        </ul> : <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] leading-5 text-slate-500">Chưa có báo cáo. Hãy chọn vị trí trên bản đồ và gửi cảnh báo đầu tiên.</p>}
      </div>
      <p className="mt-4 text-[10px] leading-4 text-slate-500">Báo cáo được lưu trên trình duyệt này, chưa đồng bộ giữa người dùng. Hãy xác minh tình hình trước khi di chuyển.</p>
    </FloatingPanel>
  );
}
