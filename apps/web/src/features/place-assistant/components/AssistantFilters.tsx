import { stopCategories, stopCategoryLabels, type StopCategory } from '@routetwin/shared';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Input, Select } from '../../../shared/ui/Input';
import type { usePlaceAssistant } from '../hooks/usePlaceAssistant';
const numberInputClass =
  'mt-1 w-full rounded-lg border border-line bg-surface text-content placeholder:text-content-subtle p-2';
type Props = {
  form: Pick<
    ReturnType<typeof usePlaceAssistant>,
    | 'inputMode'
    | 'mode'
    | 'category'
    | 'setCategory'
    | 'radius'
    | 'setRadius'
    | 'distance'
    | 'setDistance'
    | 'minutes'
    | 'setMinutes'
    | 'loading'
  >;
};
export function AssistantFilters({ form }: Props) {
  const {
    inputMode,
    mode,
    category,
    setCategory,
    radius,
    setRadius,
    distance,
    setDistance,
    minutes,
    setMinutes,
    loading,
  } = form;

  const { t } = useI18n();
  return (
    <details open={inputMode === 'actions' ? true : undefined} className="rounded-xl border border-line p-2">
      <summary className="cursor-pointer text-[11px] font-semibold text-content-muted">
        {inputMode === 'actions' ? t('Phạm vi và giới hạn') : t('Bộ lọc tùy chọn')}
      </summary>
      <div className="mt-2 space-y-2">
        {inputMode === 'text' && (
          <label className="block text-[11px]">
            {t('Loại địa điểm')}
            <Select
              value={category}
              disabled={loading}
              onChange={(event) => setCategory(event.target.value as StopCategory | '')}
              className="mt-1 w-full rounded-lg border border-line bg-surface text-content p-2"
            >
              <option value="">{t('Hiểu từ yêu cầu')}</option>
              {stopCategories.map((value) => (
                <option key={value} value={value}>
                  {t(stopCategoryLabels[value])}
                </option>
              ))}
            </Select>
          </label>
        )}
        {mode === 'nearby' ? (
          <label className="block text-[11px]">
            {t('Bán kính (km)')}
            <Input
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              disabled={loading}
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              placeholder={t('Mặc định 2 km')}
              className={numberInputClass}
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]">
              {t('Đi thêm tối đa (km)')}
              <Input
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
                disabled={loading}
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder={t('Mặc định 2 km')}
                className={numberInputClass}
              />
            </label>
            <label className="text-[11px]">
              {t('Thêm tối đa (phút)')}
              <Input
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                disabled={loading}
                type="number"
                min="0"
                max="60"
                placeholder={t('Mặc định 15 phút')}
                className={numberInputClass}
              />
            </label>
          </div>
        )}
        <p className="text-[11px] text-content-subtle">{t('Bộ lọc chọn tay được ưu tiên hơn câu nhập.')}</p>
      </div>
    </details>
  );
}
