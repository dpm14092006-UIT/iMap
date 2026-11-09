import { useEffect } from 'react';
import { Icon } from '../../../shared/components/Icon';
import { AccountForm } from './AccountForm';

export function AuthPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Đăng nhập · iMap';
    return () => { document.title = previousTitle; };
  }, []);

  return <main className="h-dvh overflow-y-auto bg-[#f5f7f5] text-ink">
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 py-6 sm:px-10 lg:px-12">
      <header className="flex items-center justify-between gap-4"><a href="/" aria-label="iMap — về bản đồ" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><Icon name="compass" size={25} /></span><span className="text-2xl font-extrabold tracking-tight">iMap<span className="text-brand-600">.</span></span></a><a href="/" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">Về bản đồ <span aria-hidden="true">↗</span></a></header>
      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-16">
        <section className="order-2 max-w-xl lg:order-1"><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-700">Đồng hành trên mọi tuyến đường</p><h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">Hành trình của bạn.<br /><span className="text-brand-600">Kết nối cùng cộng đồng.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-slate-600">Đăng nhập để chia sẻ tình hình giao thông và cùng mọi người cập nhật những điều đang diễn ra trên đường.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-white bg-white/70 p-5"><Icon name="traffic" size={23} className="text-brand-600" /><h2 className="mt-3 text-sm font-bold">Chia sẻ sự cố</h2><p className="mt-1.5 text-sm leading-6 text-slate-500">Gửi báo cáo giao thông tại vị trí bạn quan sát.</p></div><div className="rounded-2xl border border-white bg-white/70 p-5"><Icon name="check" size={23} className="text-brand-600" /><h2 className="mt-3 text-sm font-bold">Xác nhận cộng đồng</h2><p className="mt-1.5 text-sm leading-6 text-slate-500">Góp phần cập nhật trạng thái sự cố trên bản đồ.</p></div></div>
        </section>
        <section className="order-1 w-full max-w-lg justify-self-center lg:order-2 rounded-[28px] border border-white bg-white p-6 shadow-[0_20px_80px_-30px_rgba(22,65,47,0.22)] sm:p-9 lg:justify-self-end" aria-label="Tài khoản iMap"><div className="mb-6"><h2 className="text-2xl font-bold tracking-tight">Chào mừng đến iMap</h2><p className="mt-2 text-sm leading-6 text-slate-500">Đăng nhập hoặc tạo tài khoản để tham gia cộng đồng.</p></div><AccountForm /><div className="mt-6 border-t border-slate-100 pt-5 text-center"><a href="/" className="rounded-lg py-2 text-sm font-semibold text-slate-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">Tiếp tục khám phá bản đồ</a></div></section>
      </div>
      <footer className="pb-1 text-center text-xs leading-5 text-slate-400">iMap · Tìm đường và chia sẻ thông tin giao thông</footer>
    </div>
  </main>;
}
