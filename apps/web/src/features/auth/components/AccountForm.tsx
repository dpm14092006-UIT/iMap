import { useId, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthProvider';

/** Shared by the dedicated login page and the map's contextual account panel. */
export function AccountForm({ showHeading = false }: { showHeading?: boolean } = {}) {
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
  const heading = showHeading ? <div className="mb-7"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[.16em] text-brand-600">Tài khoản iMap</p><h1 className="text-[30px] font-semibold leading-tight tracking-[-.045em]">{user ? 'Sẵn sàng lên đường?' : signingUp ? 'Bắt đầu với iMap.' : 'Chào bạn trở lại.'}</h1><p className="mt-2.5 text-[13px] leading-6 text-slate-500">{user ? 'Hành trình tiếp theo đang chờ bạn.' : signingUp ? 'Tạo tài khoản để chia sẻ và xác nhận giao thông.' : 'Đăng nhập để tiếp tục hành trình của bạn.'}</p></div> : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (signingUp) {
        const hasSession = await signUp(email.trim(), password);
        setMessage(hasSession ? 'Tạo tài khoản thành công. Bạn có thể quay lại bản đồ.' : 'Đã gửi yêu cầu tạo tài khoản. Hãy kiểm tra email để xác nhận trước khi đăng nhập.');
      } else {
        await signIn(email.trim(), password);
        setMessage('Đăng nhập thành công. Bạn có thể quay lại bản đồ.');
      }
      setPassword('');
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : '';
      setError(detail === 'Invalid login credentials' ? 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.' : detail === 'Email not confirmed' ? 'Hãy xác nhận email trước khi đăng nhập.' : detail || 'Không thể xác thực tài khoản lúc này. Vui lòng thử lại.');
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

  if (loading) return <>{heading}<p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600" role="status">Đang kiểm tra phiên đăng nhập…</p></>;
  if (!configured) return <>{heading}<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="status"><p className="font-bold">Đăng nhập đang được thiết lập</p><p className="mt-1">Bạn vẫn có thể xem bản đồ và tìm đường. Vui lòng quay lại sau để đăng nhập tài khoản.</p></div></>;

  return <div>
    {heading}
    {user ? <div className="space-y-4">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5"><p className="text-xs font-semibold text-brand-700">Bạn đã đăng nhập</p><p className="mt-2 break-all text-base font-bold text-ink">{user.email}</p><p className="mt-2 text-sm leading-6 text-slate-600">Sẵn sàng gửi và xác minh báo cáo giao thông cùng cộng đồng.</p></div>
      <a href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">Tiếp tục với bản đồ</a>
      <button type="button" disabled={busy} onClick={() => void logout()} className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:opacity-50">{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
    </div> : <>
      <div className="mb-6 grid grid-cols-2 gap-5 border-b border-slate-200" aria-label="Chọn phương thức tài khoản">
        {(['sign_in', 'sign_up'] as const).map((value) => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} onClick={() => { setMode(value); setPassword(''); setError(''); setMessage(''); setShowPassword(false); }} className={`relative -mb-px min-h-11 border-b-2 px-1 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:opacity-50 ${mode === value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-ink'}`}>{value === 'sign_in' ? 'Đăng nhập' : 'Đăng ký'}</button>)}
      </div>
      <form onSubmit={(event) => void submit(event)} aria-busy={busy} className="space-y-4">
        <div><label htmlFor={`${id}-email`} className="text-xs font-semibold text-slate-600">Email</label><input id={`${id}-email`} type="email" name="email" inputMode="email" autoCapitalize="none" autoComplete="email" maxLength={254} required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-[#fafbfc] px-3.5 text-base text-ink sm:text-[13px] outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-50 disabled:bg-slate-50" /></div>
        <div><label htmlFor={`${id}-password`} className="text-xs font-semibold text-slate-600">Mật khẩu</label><div className="relative mt-2"><input id={`${id}-password`} type={showPassword ? 'text' : 'password'} name="password" placeholder="Nhập mật khẩu" autoComplete={signingUp ? 'new-password' : 'current-password'} minLength={signingUp ? 8 : undefined} required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={signingUp ? `${id}-password-help` : undefined} className="h-12 w-full rounded-xl border border-slate-200 bg-[#fafbfc] pl-3.5 pr-16 text-base text-ink sm:text-[13px] outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50 disabled:bg-slate-50" /><button type="button" aria-controls={`${id}-password`} aria-pressed={showPassword} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200">{showPassword ? 'Ẩn' : 'Hiện'}</button></div>{signingUp && <p id={`${id}-password-help`} className="mt-2 text-xs text-slate-500">Dùng ít nhất 8 ký tự. Bạn có thể cần xác nhận qua email.</p>}</div>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">{error}</p>}
        {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800" role="status">{message}</p>}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-600 px-4 text-[13px] font-semibold shadow-[0_4px_10px_-4px_rgba(36,100,210,.5)] text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-wait disabled:bg-slate-400">{busy ? 'Đang xử lý…' : signingUp ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
      </form>
    </>}
    {user && error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    {user && message && <p className="mt-4 text-sm leading-6 text-emerald-700" role="status">{message}</p>}
  </div>;
}
