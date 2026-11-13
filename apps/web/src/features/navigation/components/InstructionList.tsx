import type { RouteInstruction } from '@routetwin/shared';
import { formatDistanceMeters } from '../utils/format';
import { formatInstructionText, maneuverArrow } from '../utils/maneuver';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type InstructionListProps = { instructions: RouteInstruction[] };

/** Danh sách chỉ dẫn từng bước (rẽ trái/phải…) do VietMap trả về. */
export function InstructionList({ instructions }: InstructionListProps) {
  const { language, t } = useI18n();
  if (instructions.length === 0) return null;

  return (
    <ol
      className="max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-black/[.04] p-3 dark:bg-white/5"
      aria-label={t('Chỉ dẫn từng bước')}
    >
      {instructions.map((step, index) => (
        <li
          key={`${index}-${step.streetName}`}
          className="flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-200"
        >
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/25 dark:text-brand-200"
            aria-hidden="true"
          >
            {maneuverArrow(step.sign)}
          </span>
          <span className="min-w-0 flex-1">{formatInstructionText(step, language)}</span>
          {/* Bước cuối (đến nơi) có quãng đường 0 nên không cần hiển thị. */}
          {step.distanceMeters > 0 && (
            <span className="shrink-0 text-slate-500 dark:text-slate-400">
              {formatDistanceMeters(step.distanceMeters, language)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
