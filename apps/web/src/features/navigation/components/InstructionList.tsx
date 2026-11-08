import type { RouteInstruction } from '@routetwin/shared';
import { formatDistanceMeters } from '../utils/format';
import { maneuverArrow } from '../utils/maneuver';

type InstructionListProps = { instructions: RouteInstruction[] };

/** Danh sách chỉ dẫn từng bước (rẽ trái/phải…) do VietMap trả về. */
export function InstructionList({ instructions }: InstructionListProps) {
  if (instructions.length === 0) return null;

  return (
    <ol className="mb-3 max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-white/80 p-2.5" aria-label="Chỉ dẫn từng bước">
      {instructions.map((step, index) => (
        <li key={`${index}-${step.streetName}`} className="flex items-start gap-2 text-[10px] leading-4 text-slate-700">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700" aria-hidden="true">
            {maneuverArrow(step.sign)}
          </span>
          <span className="min-w-0 flex-1">{step.text || step.streetName || 'Tiếp tục theo đường'}</span>
          {/* Bước cuối (đến nơi) có quãng đường 0 nên không cần hiển thị. */}
          {step.distanceMeters > 0 && <span className="shrink-0 text-slate-400">{formatDistanceMeters(step.distanceMeters)}</span>}
        </li>
      ))}
    </ol>
  );
}
