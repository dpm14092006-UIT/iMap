import { Icon } from '../../../shared/components/Icon';
import type { RoutePlan } from '../../map/types';
import { formatDistanceKm, formatDurationMinutes } from '../utils/format';
import { InstructionList } from './InstructionList';

type RouteResultCardProps = { route: RoutePlan; onSave: () => void };

const vehicleLabels = { car: 'ô tô', motorcycle: 'xe máy' } as const;

/** Thẻ kết quả: tổng quãng đường, thời gian, các bước chỉ dẫn và nút lưu tuyến. */
export function RouteResultCard({ route, onSave }: RouteResultCardProps) {
  const instructions = route.legs.flatMap((leg) => leg.instructions ?? []);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Icon name="route" size={17} /></span>
          <div>
            <p className="text-[12px] font-bold text-ink">Tuyến theo đường thật</p>
            <p className="mt-0.5 text-[10px] text-slate-500">VietMap · {vehicleLabels[route.vehicle]}</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800">Đã tính</span>
      </div>

      <div className="my-3 grid grid-cols-2 divide-x divide-brand-100 rounded-xl bg-white/80 py-2.5 text-center">
        <div><p className="text-[19px] font-bold tracking-tight text-ink">{formatDistanceKm(route.distanceKm)}</p><p className="mt-0.5 text-[10px] text-slate-500">Quãng đường</p></div>
        <div><p className="text-[19px] font-bold tracking-tight text-ink">{formatDurationMinutes(route.durationMin)}</p><p className="mt-0.5 text-[10px] text-slate-500">Thời gian ước tính</p></div>
      </div>

      <InstructionList instructions={instructions} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] leading-4 text-slate-500">Thời gian có thể đổi theo giao thông.</p>
        <button type="button" onClick={onSave} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"><Icon name="bookmark" size={14} />Lưu tuyến</button>
      </div>
    </div>
  );
}
