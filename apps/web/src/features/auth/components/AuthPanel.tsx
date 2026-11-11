import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { useAuth } from '../context/AuthProvider';
import { AccountForm } from './AccountForm';

type AuthPanelProps = { onClose: () => void };

export function AuthPanel({ onClose }: AuthPanelProps) {
  const { user } = useAuth();
  return (
    <FloatingPanel
      eyebrow="TÀI KHOẢN"
      title={user ? 'Tài khoản của bạn' : 'Đăng nhập'}
      icon="pin"
      onClose={onClose}
    >
      <AccountForm />
      <a
        href="/login"
        className="mt-4 block py-2 text-center text-xs font-semibold text-brand-700 hover:underline"
      >
        Mở trang tài khoản
      </a>
    </FloatingPanel>
  );
}
