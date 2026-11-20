import { SheetPanel } from '../../../shared/ui/SheetPanel';
import { Icon } from '../../../shared/ui/Icon';
import type { SavedRoute } from '../types';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type SavedRoutesPanelProps = {
  routes: SavedRoute[];
  onClose: () => void;
  onOpen: (route: SavedRoute) => void;
  onDelete: (id: string) => void;
};

export function SavedRoutesPanel({ routes, onClose, onOpen, onDelete }: SavedRoutesPanelProps) {
  const { language, t } = useI18n();
  return (
    <SheetPanel eyebrow={t('CÁ NHÂN')} title={t('Tuyến đường đã lưu')} icon="bookmark" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50/80 dark:bg-indigo-400/10 px-3 py-3">
        <div>
          <p className="text-[12px] font-bold text-content">{t('Hành trình của bạn')}</p>
          <p className="mt-1 text-[11px] text-content-subtle">{t('Được lưu an toàn trên trình duyệt này')}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-brand-600 dark:text-indigo-300 shadow-sm">
          <Icon name="route" size={17} />
        </span>
      </div>
      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-muted text-slate-400 dark:text-slate-500">
            <Icon name="bookmark" size={22} />
          </span>
          <h3 className="mt-3 text-[13px] font-bold text-content">{t('Chưa có tuyến đã lưu')}</h3>
          <p className="mx-auto mt-1 max-w-[240px] text-[11px] leading-5 text-content-subtle">
            {t('Tìm đường hoặc tối ưu hành trình nhiều điểm, sau đó nhấn “Lưu”.')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {routes.map((route) => {
            const generatedMultiTitle = /^Hành trình (\d+) điểm · (.+)$/.exec(route.title);
            const title =
              language === 'en' && generatedMultiTitle
                ? `${generatedMultiTitle[1]}-stop trip · ${generatedMultiTitle[2]}`
                : route.title;
            return (
              <li
                key={route.id}
                className="rounded-2xl border border-line/60 bg-surface p-3 shadow-sm shadow-slate-900/[.03]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-indigo-400/10 text-brand-600 dark:text-indigo-300">
                    <Icon name="directions" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-content">{title}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-content-subtle">
                      <Icon name="pin" size={12} />
                      {route.originName} → {route.destinationName} ·{' '}
                      {t(route.kind === 'multi' ? 'Nhiều điểm' : 'Tuyến đường')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(route.id)}
                    aria-label={t('Xóa {name}', { name: title })}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(route)}
                  className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-surface-muted text-[11px] font-bold text-content-muted transition hover:bg-brand-50 dark:hover:bg-white/10 hover:text-brand-700 dark:hover:text-indigo-300"
                >
                  {t('Xem tuyến')}
                  <Icon name="arrow-up-right" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 border-t border-line/60 pt-3 text-[11px] leading-4 text-content-subtle">
        {t('Tuyến được lưu trên trình duyệt này. Khi mở lại, ứng dụng sẽ tính tuyến mới qua VietMap.')}
      </p>
    </SheetPanel>
  );
}
