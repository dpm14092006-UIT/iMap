import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';

export function AssistantAccessPanel({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  return <FloatingPanel eyebrow="DÀNH CHO THÀNH VIÊN" title="Trợ lý địa điểm" icon="sparkles" onClose={onClose}>
    {loading ? <p role="status" className="py-6 text-center text-xs text-slate-500">Đang kiểm tra tài khoản…</p> : <div className="py-2">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="sparkles" size={23} /></div>
      <h2 className="text-lg font-bold tracking-tight text-ink">Đăng nhập để dùng trợ lý AI</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">Tạo tài khoản và đăng nhập để mở các tính năng dành cho thành viên.</p>
      <ul className="my-5 space-y-3 text-xs text-slate-600">
        {['Tìm địa điểm theo nhu cầu bằng AI', 'Gợi ý điểm dừng dọc tuyến đang đi', 'Tìm kiếm bằng giọng nói'].map((label) => <li key={label} className="flex items-center gap-2"><Icon name="check" size={15} className="shrink-0 text-brand-600" />{label}</li>)}
      </ul>
      <a href="/login" className="flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700">Đăng nhập / Đăng ký</a>
      <p className="mt-4 text-[10px] leading-5 text-slate-500">Bạn vẫn có thể xem bản đồ, tìm địa chỉ và chỉ đường mà không cần tài khoản.</p>
    </div>}
  </FloatingPanel>;
}
