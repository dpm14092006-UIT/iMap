import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import type { SavedRoute } from '../types';

type SavedRoutesPanelProps = { routes: SavedRoute[]; onClose: () => void; onOpen: (route: SavedRoute) => void; onDelete: (id: string) => void };

export function SavedRoutesPanel({ routes, onClose, onOpen, onDelete }: SavedRoutesPanelProps) {
  return (
    <FloatingPanel eyebrow="CÁ NHÂN" title="Tuyến đường đã lưu" icon="bookmark" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50/80 px-3 py-3"><div><p className="text-[12px] font-bold text-ink">Hành trình của bạn</p><p className="mt-1 text-[10px] text-slate-500">Được lưu an toàn trên trình duyệt này</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Icon name="route" size={17} /></span></div>
      {routes.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400"><Icon name="bookmark" size={22} /></span><h3 className="mt-3 text-[13px] font-bold text-ink">Chưa có tuyến đã lưu</h3><p className="mx-auto mt-1 max-w-[240px] text-[11px] leading-5 text-slate-500">Tìm đường hoặc tối ưu hành trình nhiều điểm, sau đó nhấn “Lưu”.</p></div> : <ul className="space-y-2.5">{routes.map((route) => <li key={route.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-900/[.03]"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name="directions" size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-ink">{route.title}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Icon name="pin" size={12} />{route.originName} → {route.destinationName} · {route.kind === 'multi' ? 'Nhiều điểm' : 'Tuyến đường'}</p></div><button type="button" onClick={() => onDelete(route.id)} aria-label={`Xóa ${route.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Icon name="trash" size={15} /></button></div><button type="button" onClick={() => onOpen(route)} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 text-[11px] font-bold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700">Xem tuyến<Icon name="arrow-up-right" size={14} /></button></li>)}</ul>}
      <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">Lộ trình hiển thị dựa trên mạng đường mẫu TP.HCM; chưa thay thế chỉ đường thực tế.</p>
    </FloatingPanel>
  );
}
