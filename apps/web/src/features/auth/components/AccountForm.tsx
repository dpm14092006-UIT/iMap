import { useId, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useI18n } from '../../../shared/i18n/I18nProvider';

/** Shared by the dedicated login page and the map's contextual account panel. */
export function AccountForm({ showHeading = false }: { showHeading?: boolean } = {}) {
  const { t } = useI18n();
  const { user, configured, loading, signIn, signUp, signOut } = useAuth();
  const id = useId();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const signingUp = mode === 'sign_up';
  const heading = showHeading ? (
    <div className="mb-7">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.16em] text-brand-600 dark:text-indigo-300">
        {t('Tài khoản iMap')}
      </p>
      <h1 className="text-[30px] font-semibold leading-tight tracking-[-.045em]">
        {user ? t('Sẵn sàng lên đường?') : signingUp ? t('Bắt đầu với iMap.') : t('Chào bạn trở lại.')}
      </h1>
      <p className="mt-2.5 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
        {user
          ? t('Hành trình tiếp theo đang chờ bạn.')
          : signingUp
            ? t('Tạo tài khoản để chia sẻ và xác nhận giao thông.')
            : t('Đăng nhập để tiếp tục hành trình của bạn.')}
      </p>
    </div>
  ) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (signingUp) {
        const hasSession = await signUp(email.trim(), password);
        setMessage(
          hasSession
            ? 'Tạo tài khoản thành công. Bạn có thể quay lại bản đồ.'
            : 'Đã gửi yêu cầu tạo tài khoản. Hãy kiểm tra email để xác nhận trước khi đăng nhập.',
        );
      } else {
        await signIn(email.trim(), password);
        setMessage('Đăng nhập thành công. Bạn có thể quay lại bản đồ.');
      }
      setPassword('');
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : '';
      setError(
        detail === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.'
          : detail === 'Email not confirmed'
            ? 'Hãy xác nhận email trước khi đăng nhập.'
            : detail || 'Không thể xác thực tài khoản lúc này. Vui lòng thử lại.',
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await signOut();
      setMessage('Đã đăng xuất.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <>
        {heading}
        <p
          className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-5 text-sm text-slate-600 dark:text-slate-300"
          role="status"
        >
          {t('Đang kiểm tra phiên đăng nhập…')}
        </p>
      </>
    );
  if (!configured)
    return (
      <>
        {heading}
        <div
          className="rounded-2xl border border-amber-200 dark:border-amber-300/20 bg-amber-50 dark:bg-amber-400/10 p-5 text-sm leading-6 text-amber-950 dark:text-amber-100"
          role="status"
        >
          <p className="font-bold">{t('Đăng nhập đang được thiết lập')}</p>
          <p className="mt-1">
            {t('Bạn vẫn có thể xem bản đồ và tìm đường. Vui lòng quay lại sau để đăng nhập tài khoản.')}
          </p>
        </div>
      </>
    );

  return (
    <div>
      {heading}
      {user ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50 dark:bg-indigo-400/10 p-5">
            <p className="text-xs font-semibold text-brand-700 dark:text-indigo-300">
              {t('Bạn đã đăng nhập')}
            </p>
            <p className="mt-2 break-all text-base font-bold text-ink dark:text-slate-100">{user.email}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('Sẵn sàng gửi và xác minh báo cáo giao thông cùng cộng đồng.')}
            </p>
          </div>
          <a
            href="/"
            className="flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 dark:focus-visible:ring-indigo-400/30"
          >
            {t('Tiếp tục với bản đồ')}
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logout()}
            className="min-h-11 w-full rounded-xl border border-slate-200 dark:border-white/10 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 dark:focus-visible:ring-indigo-400/30 disabled:opacity-50"
          >
            {busy ? t('Đang đăng xuất…') : t('Đăng xuất')}
          </button>
        </div>
      ) : (
        <>
          <div
            className="mb-6 grid grid-cols-2 gap-5 border-b border-slate-200 dark:border-white/10"
            role="group"
            aria-label={t('Chọn phương thức tài khoản')}
          >
            {(['sign_in', 'sign_up'] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setPassword('');
                  setError('');
                  setMessage('');
                  setShowPassword(false);
                }}
                className={`relative -mb-px min-h-11 border-b-2 px-1 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 dark:focus-visible:ring-indigo-400/30 disabled:opacity-50 ${mode === value ? 'border-brand-600 text-brand-700 dark:text-indigo-300' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'}`}
              >
                {value === 'sign_in' ? t('Đăng nhập') : t('Đăng ký')}
              </button>
            ))}
          </div>
          <form onSubmit={(event) => void submit(event)} aria-busy={busy} className="space-y-4">
            <div>
              <label
                htmlFor={`${id}-email`}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Email
              </label>
              <input
                id={`${id}-email`}
                type="email"
                name="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                maxLength={254}
                required
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@example.com"
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-[#fafbfc] dark:bg-slate-800 px-3.5 text-base text-ink dark:text-slate-100 sm:text-[13px] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-400 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-50 dark:focus:ring-indigo-400/20 disabled:bg-slate-50 dark:disabled:bg-slate-800/40"
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-password`}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                {t('Mật khẩu')}
              </label>
              <div className="relative mt-2">
                <input
                  id={`${id}-password`}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('Nhập mật khẩu')}
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  minLength={signingUp ? 8 : undefined}
                  required
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={signingUp ? `${id}-password-help` : undefined}
                  className="h-12 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-[#fafbfc] dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-3.5 pr-16 text-base text-ink dark:text-slate-100 sm:text-[13px] outline-none focus:border-brand-400 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-50 dark:focus:ring-indigo-400/20 disabled:bg-slate-50 dark:disabled:bg-slate-800/40"
                />
                <button
                  type="button"
                  aria-controls={`${id}-password`}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40"
                >
                  {showPassword ? t('Ẩn') : t('Hiện')}
                </button>
              </div>
              {signingUp && (
                <p id={`${id}-password-help`} className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('Dùng ít nhất 8 ký tự. Bạn có thể cần xác nhận qua email.')}
                </p>
              )}
            </div>
            {error && (
              <p
                className="rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-700 dark:text-red-300"
                role="alert"
              >
                {t(error)}
              </p>
            )}
            {message && (
              <p
                className="rounded-xl bg-emerald-50 dark:bg-emerald-400/10 px-4 py-3 text-sm leading-5 text-emerald-800 dark:text-emerald-300"
                role="status"
              >
                {t(message)}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 w-full rounded-xl bg-brand-600 px-4 text-[13px] font-semibold shadow-[0_4px_10px_-4px_rgba(36,100,210,.5)] text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 dark:focus-visible:ring-indigo-400/30 disabled:cursor-wait disabled:bg-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              {busy ? t('Đang xử lý…') : signingUp ? t('Tạo tài khoản') : t('Đăng nhập')}
            </button>
          </form>
        </>
      )}
      {user && error && (
        <p
          className="mt-4 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          {t(error)}
        </p>
      )}
      {user && message && (
        <p className="mt-4 text-sm leading-6 text-emerald-700 dark:text-emerald-300" role="status">
          {t(message)}
        </p>
      )}
    </div>
  );
}
