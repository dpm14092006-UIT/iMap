import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { confidenceLabels } from '../domain/trafficPresentation';
import type { useTrafficReportForm } from '../hooks/useTrafficReportForm';
import { PhotoPicker } from './PhotoPicker';

type Props = {
  form: Pick<
    ReturnType<typeof useTrafficReportForm>,
    | 'photo'
    | 'setPhoto'
    | 'photoPreview'
    | 'aiStatus'
    | 'imageAnalysis'
    | 'setImageAnalysis'
    | 'analysisTask'
    | 'busy'
    | 'selectPhoto'
    | 'analyzePhoto'
    | 'applyIncidentSuggestion'
  >;
};
export function TrafficPhotoField({ form }: Props) {
  const {
    photo,
    setPhoto,
    photoPreview,
    aiStatus,
    imageAnalysis,
    setImageAnalysis,
    analysisTask,
    busy,
    selectPhoto,
    analyzePhoto,
    applyIncidentSuggestion,
  } = form;

  const { t } = useI18n();
  return (
    <div className="mb-3 rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-content-muted">
          {t('Ảnh hiện trường')}{' '}
          <span className="font-normal text-slate-400 dark:text-slate-500">({t('không bắt buộc')})</span>
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('Tối đa 5 MB')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <PhotoPicker
          label={t('Chụp ảnh')}
          icon="camera"
          capture
          disabled={Boolean(analysisTask) || busy}
          onPick={selectPhoto}
          className="bg-brand-50 text-brand-700 hover:bg-brand-100 focus-within:ring-brand-100 dark:bg-indigo-400/10 dark:text-indigo-300 dark:hover:bg-indigo-400/20 dark:focus-within:ring-indigo-400/25"
        />
        <PhotoPicker
          label={t('Chọn ảnh')}
          icon="upload"
          disabled={Boolean(analysisTask) || busy}
          onPick={selectPhoto}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200 focus-within:ring-slate-200 dark:bg-slate-700/50 dark:text-slate-200 dark:hover:bg-white/15 dark:focus-within:ring-white/10"
        />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-400 dark:text-slate-500">
        {t(
          'Trên điện thoại, nút Chụp ảnh sẽ mở camera. Ảnh chỉ được lưu cùng báo cáo khi bạn bấm Gửi báo cáo.',
        )}
      </p>
      {photo && photoPreview && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface-muted p-2">
          <img
            src={photoPreview}
            alt={t('Xem trước ảnh hiện trường')}
            className="h-16 w-20 rounded-md object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-[11px] text-content-muted">{photo.name}</span>
          <button
            type="button"
            aria-label={t('Xóa ảnh đã chọn')}
            disabled={busy || Boolean(analysisTask)}
            onClick={() => {
              setPhoto(null);
              setImageAnalysis(null);
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-content-subtle hover:bg-white dark:hover:bg-slate-700/60 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      )}
      {photo && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <p className="mb-2 text-[11px] font-semibold text-content-muted">
            {t('Hỗ trợ từ AI')}{' '}
            <span className="font-normal text-slate-400 dark:text-slate-500">({t('tùy chọn')})</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-busy={analysisTask === 'incident'}
              disabled={Boolean(analysisTask) || busy || aiStatus !== 'ready'}
              onClick={() => void analyzePhoto('incident')}
              className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 dark:border-indigo-300/25 bg-brand-50 dark:bg-indigo-400/10 px-2 text-[11px] font-semibold text-brand-700 dark:text-indigo-300 hover:bg-brand-100 dark:hover:bg-indigo-400/20 disabled:opacity-50"
            >
              {analysisTask === 'incident' ? t('Đang phân tích…') : t('Gợi ý loại sự cố')}
            </button>
            <button
              type="button"
              aria-busy={analysisTask === 'traffic_sign'}
              disabled={Boolean(analysisTask) || busy || aiStatus !== 'ready'}
              onClick={() => void analyzePhoto('traffic_sign')}
              className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold text-content-muted hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              {analysisTask === 'traffic_sign' ? t('Đang nhận diện…') : t('Nhận diện biển báo')}
            </button>
          </div>
          {aiStatus === 'ready' ? (
            <p className="mt-2 text-[11px] leading-4 text-content-subtle">
              {t(
                'Ảnh chỉ được gửi đến Google Gemini khi bạn bấm một nút trên. Với gói miễn phí, Google có thể dùng nội dung để cải thiện dịch vụ và người đánh giá có thể xem. Tránh ảnh có khuôn mặt hoặc biển số.',
              )}
            </p>
          ) : (
            <p className="mt-2 text-[11px] leading-4 text-content-subtle">
              {aiStatus === 'checking'
                ? t('Đang kiểm tra cấu hình Gemini…')
                : t('Tính năng phân tích ảnh hiện chưa khả dụng.')}
            </p>
          )}
          {analysisTask && (
            <p className="mt-2 text-[11px] text-brand-700 dark:text-indigo-300" role="status">
              {t('Đang phân tích ảnh…')}
            </p>
          )}
          {imageAnalysis?.task === 'incident' && (
            <div
              className="mt-3 rounded-lg border border-brand-100 dark:border-indigo-300/20 bg-brand-50/70 dark:bg-indigo-400/10 p-3"
              role="status"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-brand-800 dark:text-indigo-300">
                  {t('Gợi ý sự cố')}
                </span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-content-muted">
                  {t('Tin cậy: {confidence}', {
                    confidence: t(confidenceLabels[imageAnalysis.confidence]),
                  })}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-content-muted">{imageAnalysis.summary}</p>
              {imageAnalysis.evidence.length > 0 && (
                <p className="mt-1 text-[11px] leading-4 text-content-subtle">
                  {t('Quan sát: {details}', { details: imageAnalysis.evidence.join(' · ') })}
                </p>
              )}
              {!imageAnalysis.trafficRelated && (
                <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-200">
                  {t('Ảnh chưa đủ căn cứ để xác định sự cố giao thông.')}
                </p>
              )}
              <p className="mt-1 text-[11px] text-content-subtle">
                {t('AI chỉ gợi ý loại sự cố và ghi chú. Mức độ do bạn tự chọn.')}
              </p>
              <button
                type="button"
                disabled={!imageAnalysis.trafficRelated}
                onClick={applyIncidentSuggestion}
                className="mt-2 min-h-8 rounded-lg bg-surface px-3 text-[11px] font-semibold text-brand-700 dark:text-indigo-300 ring-1 ring-brand-200 dark:ring-indigo-300/30 hover:bg-brand-100 dark:hover:bg-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('Dùng gợi ý để điền form')}
              </button>
            </div>
          )}
          {imageAnalysis?.task === 'traffic_sign' && (
            <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3" role="status">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-content">{t('Nhận diện biển báo')}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-content-muted">
                  {t('Tin cậy: {confidence}', {
                    confidence: t(confidenceLabels[imageAnalysis.confidence]),
                  })}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-content-muted">
                {imageAnalysis.trafficSign ? imageAnalysis.label : t('Chưa nhận diện được biển báo rõ ràng')}
              </p>
              {imageAnalysis.visibleText && (
                <p className="mt-1 text-[11px] text-content-subtle">
                  {t('Chữ/số nhìn thấy: {text}', { text: imageAnalysis.visibleText })}
                </p>
              )}
              <p className="mt-1 text-[11px] leading-4 text-amber-700 dark:text-amber-200">
                {t(
                  'Chỉ là gợi ý hình ảnh; hiệu lực còn phụ thuộc chiều đường và biển phụ. Không tự thay đổi tuyến đường.',
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
