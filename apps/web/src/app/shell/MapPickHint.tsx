import type { PickTarget } from '../../features/routing/components/RoutePanel';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Icon } from '../../shared/ui/Icon';

/** Hướng dẫn khi đang chọn điểm đi/đến bằng cách chạm bản đồ. */
export function MapPickHint({ target, onCancel }: { target: PickTarget; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="absolute left-1/2 top-[76px] z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900/90 py-2 pl-4 pr-2 text-xs font-semibold text-white shadow-glass dark:shadow-glass-dark ring-1 ring-white/15 backdrop-blur-xl max-md:top-[116px]"
      role="status"
    >
      <Icon name="pin" size={15} className="text-teal-300" />
      {t('Chạm vào bản đồ để chọn {target}', { target: t(target === 'origin' ? 'điểm đi' : 'điểm đến') })}
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        {t('Hủy')}
      </button>
    </div>
  );
}
