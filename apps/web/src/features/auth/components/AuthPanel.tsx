import { useState, type FormEvent } from 'react';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import { useAuth } from '../context/AuthProvider';

type AuthPanelProps = { onClose: () => void };

export function AuthPanel({ onClose }: AuthPanelProps) {
  const { user, configured, loading, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'sign_in') {
        await signIn(email.trim(), password);
        setMessage('Đăng nhập thành công.');
      } else {
        const hasSession = await signUp(email.trim(), password);
        setMessage(hasSession ? 'Tạo tài khoản thành công.' : 'Đã tạo tài khoản. Hãy kiểm tra email để xác nhận rồi đăng nhập.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác thực tài khoản lúc này.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      await signOut();
      setMessage('Đã đăng xuất.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingPanel eyebrow="TÀI KHOẢN" title={user ? 'Tài khoản của bạn' : 'Đăng nhập'} icon="pin" onClose={onClose}>
      {loading ? <p className="text-[12px] text-slate-500" role="status">Đang kiểm tra phiên đăng nhập…</p> : user ? <div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-500">Đã đăng nhập bằng</p><p className="mt-1 break-all text-[12px] font-bold text-ink">{user.email}</p></div>
        <button type="button" disabled={busy} onClick={() => void logout()} className="mt-3 h-11 w-full rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Đăng xuất'}</button>
      </div> : !configured ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><p className="font-bold">Supabase Auth chưa được cấu hình</p><p className="mt-1">Thêm VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY vào apps/web/.env rồi khởi động lại web.</p></div> : <>
        <p className="mb-4 text-[11px] leading-5 text-slate-500">Đăng nhập để gửi và xác minh báo cáo cộng đồng, đồng bộ kết quả phân tích.</p>
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <label className="block text-[10px] font-semibold text-slate-600">Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-normal text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50" />
          </label>
          <label className="block text-[10px] font-semibold text-slate-600">Mật khẩu
            <input type="password" autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-normal text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50" />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-700" role="alert">{error}</p>}
          {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] leading-4 text-emerald-800" role="status">{message}</p>}
          <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700 disabled:bg-slate-300"><Icon name="check" size={16} />{busy ? 'Đang xử lý…' : mode === 'sign_in' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in'); setError(''); setMessage(''); }} className="mt-3 w-full py-2 text-[10px] font-semibold text-brand-700 hover:underline">{mode === 'sign_in' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
      </>}
      {error && user && <p className="mt-3 text-[10px] text-red-700" role="alert">{error}</p>}
      {message && user && <p className="mt-3 text-[10px] text-emerald-700" role="status">{message}</p>}
    </FloatingPanel>
  );
}
