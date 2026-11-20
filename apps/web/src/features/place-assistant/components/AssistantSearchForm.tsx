import { stopCategories, stopCategoryLabels } from '@routetwin/shared';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Button } from '../../../shared/ui/Button';
import { Textarea } from '../../../shared/ui/Input';
import type { usePlaceAssistant } from '../hooks/usePlaceAssistant';
import { AssistantFilters } from './AssistantFilters';

type Props = {
  form: Pick<
    ReturnType<typeof usePlaceAssistant>,
    | 'aiConfigured'
    | 'inputMode'
    | 'query'
    | 'setQuery'
    | 'mode'
    | 'category'
    | 'setCategory'
    | 'radius'
    | 'setRadius'
    | 'distance'
    | 'setDistance'
    | 'minutes'
    | 'setMinutes'
    | 'setResult'
    | 'setError'
    | 'loading'
    | 'examples'
    | 'cancelSearch'
    | 'handleSubmit'
  >;
};
export function AssistantSearchForm({ form }: Props) {
  const {
    aiConfigured,
    inputMode,
    query,
    setQuery,
    category,
    setCategory,
    setResult,
    setError,
    loading,
    examples,
    cancelSearch,
    handleSubmit,
  } = form;

  const { t } = useI18n();
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {inputMode === 'text' ? (
        <>
          <p
            role="status"
            className="rounded-xl bg-surface-muted p-2 text-[11px] leading-5 text-content-muted"
          >
            {aiConfigured === true
              ? t('Đã cấu hình AI hiểu nhu cầu. Nếu dịch vụ lỗi, trợ lý sẽ thông báo khi dùng từ khóa.')
              : aiConfigured === false
                ? t('AI chưa bật. Bạn vẫn có thể nhập nhu cầu đơn giản; trợ lý đang hiểu bằng từ khóa.')
                : t('Chưa xác nhận được trạng thái AI. Nguồn xử lý sẽ hiển thị cùng kết quả.')}
          </p>
          <label className="block text-[11px] font-semibold text-content-muted">
            {t('Nhu cầu của bạn')}
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading}
              maxLength={300}
              rows={3}
              placeholder={t('Ví dụ: Tìm trạm xăng trong bán kính 2 km')}
              className="mt-1 w-full rounded-xl border border-line bg-surface text-content placeholder:text-content-subtle p-3 text-[12px] font-normal focus:border-brand-500 dark:focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/40"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => {
                  setQuery(example);
                  setCategory('');
                }}
                className="rounded-full bg-surface-raised px-2 py-1 text-[11px] text-content-muted disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </>
      ) : (
        <fieldset disabled={loading}>
          <legend className="mb-2 text-[11px] font-semibold text-content-muted">
            {t('Bạn muốn tìm gì?')}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {stopCategories.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => {
                  setCategory(value);
                  setResult(null);
                  setError('');
                }}
                className={`rounded-xl border p-2 text-left text-[11px] font-semibold ${category === value ? 'border-brand-500 bg-brand-50 dark:bg-indigo-400/10 text-brand-700 dark:text-indigo-300' : 'border-line text-content-muted'}`}
              >
                {t(stopCategoryLabels[value])}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <AssistantFilters form={form} />
      <Button
        type="submit"
        disabled={loading || (inputMode === 'actions' && !category)}
        className="w-full rounded-xl bg-brand-600 p-3 text-[12px] font-bold text-white hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
      >
        {loading ? t('Đang tìm địa điểm…') : t('Tìm địa điểm')}
      </Button>
      {loading && (
        <button type="button" onClick={cancelSearch} className="w-full text-[11px] text-content-subtle">
          {t('Hủy tìm kiếm')}
        </button>
      )}
    </form>
  );
}
