import { SheetPanel } from '../../../shared/ui/SheetPanel';
import { useMultiStopForm } from '../hooks/useMultiStopForm';
import type { MultiStopPanelProps } from '../types';
import { MultiStopEditor } from './MultiStopEditor';
import { MultiStopResult } from './MultiStopResult';

export function MultiStopPanel(props: MultiStopPanelProps) {
  const { isActive, onStartNavigation, isNavigating, onClose, onSave, getFocus, presentationSlot } = props;
  const form = useMultiStopForm(props);
  const { t, error } = form;
  return (
    <SheetPanel
      eyebrow={t('LẬP KẾ HOẠCH')}
      title={t('Hành trình nhiều điểm')}
      icon="multi-stop"
      onClose={onClose}
      hidden={!isActive}
    >
      <p className="mb-4 text-[12px] leading-5 text-content-subtle">
        {t(
          'Chọn các điểm cần ghé. Tự sắp xếp thứ tự tốt nhất theo thời gian hoặc quãng đường, giữ cố định điểm xuất phát.',
        )}
      </p>
      <MultiStopEditor getFocus={getFocus} presentationSlot={presentationSlot} form={form} />
      {error && (
        <p
          className="mt-3 rounded-xl border border-amber-200 dark:border-amber-300/20 bg-amber-50 dark:bg-amber-400/10 px-3 py-2.5 text-[11px] leading-5 text-amber-900 dark:text-amber-100"
          role="alert"
        >
          {t(error.source, error.values)}
        </p>
      )}
      <MultiStopResult
        onStartNavigation={onStartNavigation}
        isNavigating={isNavigating}
        onSave={onSave}
        form={form}
      />
      <div className="mt-4 border-t border-line/60 pt-3 text-[11px] leading-5 text-content-subtle">
        {t(
          'Tối ưu theo chi phí đường bộ VietMap, có xét chiều di chuyển. Để đi theo thứ tự tự chọn, dùng mục Chỉ đường.',
        )}
      </div>
    </SheetPanel>
  );
}
