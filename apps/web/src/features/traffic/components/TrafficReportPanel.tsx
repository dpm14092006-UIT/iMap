import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { Textarea } from '../../../shared/ui/Input';
import { SheetPanel } from '../../../shared/ui/SheetPanel';
import { severityOptions, vehicleScopeLabels } from '../domain/trafficPresentation';
import { useTrafficReportForm } from '../hooks/useTrafficReportForm';
import type { TrafficReportPanelProps } from '../types';
import { TrafficIncidentList } from './TrafficIncidentList';
import { TrafficPhotoField } from './TrafficPhotoField';
import { TrafficReportFields } from './TrafficReportFields';

export function TrafficReportPanel(props: TrafficReportPanelProps & { onViewMap: () => void }) {
  const { incidents, selectedPoint, isAuthenticated, loading, error, onClose, onSignIn } = props;
  const form = useTrafficReportForm(props);
  const [view, setView] = useState<'list' | 'map' | 'report'>(() => (selectedPoint ? 'report' : 'list'));
  const {
    t,
    severity,
    setSeverity,
    vehicleScope,
    setVehicleScope,
    note,
    setNote,
    analysisTask,
    busy,
    actionMessage,
    actionError,
    submit,
  } = form;
  return (
    <SheetPanel title={t('Tình hình giao thông')} icon="traffic" onClose={onClose}>
      <div className="mb-3 grid grid-cols-3 gap-1.5" aria-label={t('Tình hình giao thông')} role="group">
        {(
          [
            ['list', 'Danh sách', 'filter'],
            ['map', 'Bản đồ', 'layers'],
            ['report', 'Báo sự cố', 'warning'],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => {
              setView(key);
              if (key === 'map') props.onViewMap();
            }}
            className={`ui-button min-h-11 gap-1 px-1 ${view === key ? 'ui-button-primary' : 'ui-button-secondary'}`}
          >
            <Icon name={icon} size={16} className="shrink-0" />
            {t(label)}
          </button>
        ))}
      </div>
      {view === 'map' && (
        <p className="rounded-xl border border-line bg-surface-muted p-3 text-sm text-content-muted">
          {t('Xem ghim sự cố trên bản đồ. Chạm vào bản đồ để chọn vị trí báo cáo.')}
        </p>
      )}
      {view === 'report' && (
        <>
          <TrafficReportFields selectedPoint={selectedPoint} form={form} />

          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-content-muted">
              {t('Mức độ sự cố · chọn thủ công')}
            </span>
            <div className="flex gap-1">
              {severityOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={severity === item.id}
                  onClick={() => setSeverity(item.id)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${severity === item.id ? 'bg-surface-raised text-content' : 'text-content-subtle hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                  {t(item.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="mb-1.5 text-[11px] font-semibold text-content-muted">
              {t('Áp dụng cho loại xe')}
            </div>
            <div
              className="grid grid-cols-3 gap-1 rounded-lg bg-surface-raised p-1"
              role="group"
              aria-label={t('Loại xe áp dụng báo cáo')}
            >
              {(['motorcycle', 'car', 'both'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  aria-pressed={vehicleScope === scope}
                  onClick={() => setVehicleScope(scope)}
                  className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition ${vehicleScope === scope ? 'bg-surface text-brand-700 dark:text-indigo-300 shadow-sm' : 'text-content-subtle hover:text-ink dark:hover:text-slate-100'}`}
                >
                  {t(vehicleScopeLabels[scope])}
                </button>
              ))}
            </div>
          </div>
          <label className="mb-3 block text-[11px] font-semibold text-content-muted">
            {t('Ghi chú ngắn')}{' '}
            <span className="font-normal text-slate-400 dark:text-slate-500">({t('không bắt buộc')})</span>
            <Textarea
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={t('Ví dụ: ngập sâu gần giao lộ…')}
              className="mt-1.5 w-full resize-none rounded-xl bg-surface border border-line px-3 py-2 text-[11px] font-normal text-content outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-400 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-50 dark:focus:ring-indigo-400/20"
            />
          </label>
          <TrafficPhotoField form={form} />
          {isAuthenticated ? (
            <Button
              type="button"
              disabled={!selectedPoint || busy || Boolean(analysisTask)}
              onClick={() => void submit()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              <Icon name="send" size={16} />
              {busy ? t('Đang gửi…') : t('Gửi báo cáo')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSignIn}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700"
            >
              <Icon name="pin" size={16} />
              {t('Đăng nhập để gửi báo cáo')}
            </Button>
          )}
          {!selectedPoint && (
            <p className="mt-2 text-center text-[11px] text-content-subtle">
              {t('Chọn đúng vị trí trên bản đồ trước khi gửi.')}
            </p>
          )}
          {actionMessage && (
            <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300" role="status">
              {t(actionMessage)}
            </p>
          )}
          {(actionError || error) && (
            <p
              className="mt-2 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[11px] leading-4 text-red-700 dark:text-red-300"
              role="alert"
            >
              {t(actionError || error)}
            </p>
          )}
        </>
      )}
      {view === 'list' && (
        <TrafficIncidentList
          incidents={incidents}
          isAuthenticated={isAuthenticated}
          loading={loading}
          error={error}
          form={form}
        />
      )}
      <p className="mt-4 text-[11px] leading-4 text-content-subtle">
        {t(
          'Báo cáo được chia sẻ với mọi người dùng iMap và tự ẩn khi hết hạn. Hãy tự xác minh tình hình trước khi di chuyển.',
        )}
      </p>
    </SheetPanel>
  );
}
