import type { CompareRoutesRequest, RouteComparisonResult, RoutePreferenceGoal } from '@routetwin/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/ApiError';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Input } from '../../../shared/ui/Input';
import { useAuth } from '../../auth/context/AuthProvider';
import type { DirectionsComparison, RouteApiClient } from '../api/RouteApiClient';

const goalLabel: Record<RoutePreferenceGoal, string> = {
  fastest: 'Nhanh nhất',
  shortest: 'Ngắn nhất',
  'fewest-turns': 'Ít rẽ nhất',
};
const statusLabel = {
  equivalent: 'Có nhiều tuyến cùng tốt nhất theo tiêu chí này.',
  'single-route': 'VietMap chỉ trả về một tuyến cho hành trình này.',
  'no-match': 'Không có tuyến phù hợp với các điều kiện đã chọn.',
  'unknown-turns': 'Thiếu dữ liệu số lần rẽ để so sánh theo tiêu chí này.',
  clarify: 'Hãy nêu một ưu tiên: nhanh nhất, ngắn nhất hoặc ít rẽ nhất.',
};

type Props = {
  snapshot: DirectionsComparison;
  compare: RouteApiClient['compare'];
  onChoose: (id: string) => void;
  onRefresh: () => void;
  selectedId: string;
  isNavigating: boolean;
};

export function RouteComparisonPanel({
  snapshot,
  compare,
  onChoose,
  onRefresh,
  selectedId,
  isNavigating,
}: Props) {
  const { t, language } = useI18n();
  const { user, accessToken } = useAuth();
  const canUseAi = snapshot.aiAvailable && Boolean(user && !user.is_anonymous && accessToken);
  const [text, setText] = useState('');
  const [result, setResult] = useState<RouteComparisonResult>();
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), [snapshot.token, accessToken]);

  async function submit(preference: CompareRoutesRequest['preference']) {
    pending.current?.abort();
    setResult(undefined);
    setError('');
    if (snapshot.expiresAt <= Date.now()) {
      setBusy(false);
      setExpired(true);
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const response = await compare(snapshot.token, preference, {
        signal: controller.signal,
        ...(canUseAi && preference.kind === 'text' && accessToken ? { accessToken } : {}),
      });
      if (!controller.signal.aborted) setResult(response);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 410) setExpired(true);
      else setError(cause instanceof ApiError ? cause.message : 'Chưa thể so sánh tuyến. Hãy thử lại.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim()) void submit({ kind: 'text', text });
  }

  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const signedNumber = new Intl.NumberFormat(language, {
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  });
  const chosen = snapshot.routes.find(({ id }) => id === result?.recommendedId);
  const preference = result?.preference;
  const compactButton =
    'rounded-full border border-slate-200 px-3 py-2 font-semibold enabled:hover:bg-brand-50 disabled:opacity-50 dark:border-white/15 dark:enabled:hover:bg-white/10';
  const unit = (id: RouteComparisonResult['evidence'][number]['id']) =>
    t(id === 'duration' ? 'phút' : id === 'distance' ? 'km' : 'lần rẽ');

  return (
    <details className="mb-3 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-xs dark:border-white/15 dark:bg-white/5">
      <summary className="cursor-pointer py-1 text-sm font-bold text-content">
        {t('So sánh và giải thích tuyến')}
      </summary>
      <div className="mt-2 space-y-3">
        <table className="w-full text-right tabular-nums">
          <thead className="text-content-muted">
            <tr>
              <th scope="col" className="pb-1 text-left">
                {t('Tuyến')}
              </th>
              <th scope="col" className="pb-1">
                {t('Phút (ước tính)')}
              </th>
              <th scope="col" className="pb-1">
                km
              </th>
              <th scope="col" className="pb-1">
                {t('Số lần rẽ')}
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshot.routes.map((route) => (
              <tr key={route.id} className="border-t border-line">
                <th scope="row" className="py-1.5 text-left">
                  {route.id}
                </th>
                <td>{number.format(route.durationSeconds / 60)}</td>
                <td>{number.format(route.distanceMeters / 1000)}</td>
                <td>{route.turnCount === null ? '—' : number.format(route.turnCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-1.5" aria-label={t('Ưu tiên tuyến')}>
          {(Object.entries(goalLabel) as [RoutePreferenceGoal, string][]).map(([goal, label]) => (
            <button
              key={goal}
              type="button"
              disabled={expired}
              className={compactButton}
              onClick={() => void submit({ kind: 'preset', goal })}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <form onSubmit={submitText} className="space-y-1.5">
          <label className="block font-semibold">
            {t('Nhập ưu tiên của bạn')}
            <Input
              className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-base text-ink dark:border-white/20 dark:bg-slate-900 dark:text-white"
              value={text}
              maxLength={240}
              placeholder={t('Ít rẽ hơn, đi thêm tối đa 5 phút')}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {canUseAi && (
            <p className="text-content-muted">
              {t('Câu nhập được gửi tới dịch vụ AI. Tránh nhập thông tin cá nhân.')}
            </p>
          )}
          {snapshot.aiAvailable && !canUseAi && (
            <p className="text-content-muted">
              {t('Đăng nhập để AI đọc ưu tiên. Khách dùng quy tắc có sẵn.')}
            </p>
          )}
          <button type="submit" disabled={expired || !text.trim()} className={compactButton}>
            {t('Giải thích lựa chọn')}
          </button>
        </form>
        <div aria-live="polite" className="space-y-2">
          {busy && <p>{t('Đang đối chiếu các tuyến…')}</p>}
          {error && <p className="text-amber-800 dark:text-amber-200">{t(error)}</p>}
          {expired && (
            <button type="button" disabled={isNavigating} className={compactButton} onClick={onRefresh}>
              {t('So sánh đã hết hạn. Tính lại tuyến')}
            </button>
          )}
          {result && (
            <div className="space-y-1.5 rounded-xl bg-brand-50 p-2.5 dark:bg-brand-500/10">
              <p className="font-bold">
                {chosen
                  ? t('Đề xuất tuyến {route}', { route: chosen.id })
                  : result.status !== 'recommended'
                    ? t(statusLabel[result.status])
                    : null}
              </p>
              {preference?.goal && (
                <p>
                  {t(goalLabel[preference.goal])}
                  {preference.maxExtraMinutes !== null
                    ? ' · ' + t('Thêm tối đa {minutes} phút', { minutes: preference.maxExtraMinutes })
                    : ''}
                </p>
              )}
              {result.evidence.length > 0 && result.recommendedId !== result.baselineId && (
                <p>
                  {t('So với tuyến nhanh nhất {route}', { route: result.baselineId })}
                  {result.evidence
                    .map(
                      ({ id, delta }) =>
                        signedNumber.format(delta / (id === 'duration' ? 60 : id === 'distance' ? 1000 : 1)) +
                        ' ' +
                        unit(id),
                    )
                    .join(' · ')}
                </p>
              )}
              <p className="text-content-muted">
                {t(
                  result.source === 'ai'
                    ? 'AI đọc ưu tiên. Số liệu từ VietMap.'
                    : 'So sánh theo quy tắc. Số liệu từ VietMap.',
                )}
              </p>
              {chosen && !isNavigating && chosen.planId !== selectedId && (
                <button type="button" className={compactButton} onClick={() => onChoose(chosen.planId)}>
                  {t('Chọn tuyến {route}', { route: chosen.id })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
