import { SheetPanel } from '../../../shared/ui/SheetPanel';
import { Icon } from '../../../shared/ui/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';

export function AssistantAccessPanel({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <SheetPanel
      eyebrow={t('DÀNH CHO THÀNH VIÊN')}
      title={t('Trợ lý địa điểm')}
      icon="sparkles"
      onClose={onClose}
    >
      {loading ? (
        <p role="status" className="py-6 text-center text-xs text-content-subtle">
          {t('Đang kiểm tra tài khoản…')}
        </p>
      ) : (
        <div className="py-2">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 dark:bg-indigo-400/10 text-brand-600 dark:text-indigo-300">
            <Icon name="sparkles" size={23} />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-content">
            {t('Đăng nhập để dùng trợ lý AI')}
          </h2>
          <p className="mt-2 text-xs leading-6 text-content-subtle">
            {t('Tạo tài khoản và đăng nhập để mở các tính năng dành cho thành viên.')}
          </p>
          <ul className="my-5 space-y-3 text-xs text-content-muted">
            {[t('Tìm địa điểm theo nhu cầu bằng AI'), t('Gợi ý điểm dừng dọc tuyến đang đi')].map((label) => (
              <li key={label} className="flex items-center gap-2">
                <Icon name="check" size={15} className="shrink-0 text-brand-600 dark:text-indigo-300" />
                {label}
              </li>
            ))}
          </ul>
          <a
            href="/login"
            className="flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {t('Đăng nhập / Đăng ký')}
          </a>
          <p className="mt-4 text-[11px] leading-5 text-content-subtle">
            {t('Bạn vẫn có thể xem bản đồ, tìm địa chỉ và chỉ đường mà không cần tài khoản.')}
          </p>
        </div>
      )}
    </SheetPanel>
  );
}
