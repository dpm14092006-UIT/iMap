import { useEffect } from 'react';
import { Icon } from '../../../shared/components/Icon';
import { useTimeBasedMapLayer } from '../../map/hooks/useTimeBasedMapLayer';
import { AccountForm } from './AccountForm';
import { useI18n } from '../../../shared/i18n/I18nProvider';

/** Decorative route illustration: no location requests or third-party map tiles. */
function RouteIllustration() {
  const { t } = useI18n();
  return (
    <aside
      className="relative hidden overflow-hidden rounded-[24px] bg-[#edf1ed] dark:bg-slate-900 md:block"
      aria-label={t('Minh họa hành trình')}
    >
      <svg
        viewBox="0 0 520 640"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect width="520" height="640" fill="#edf1ed" className="dark:fill-slate-900" />
        <path
          d="M400-40C320 70 503 123 405 254S438 428 346 680"
          fill="none"
          stroke="#cfe1e7"
          className="dark:stroke-slate-800"
          strokeWidth="61"
        />
        <g
          transform="rotate(-17 240 300)"
          fill="#e0e6de"
          stroke="#edf1ed"
          strokeWidth="7"
          className="dark:fill-slate-800/80 dark:stroke-slate-900"
        >
          <rect x="-40" y="20" width="150" height="96" rx="13" />
          <rect x="133" y="20" width="126" height="96" rx="13" />
          <rect x="282" y="20" width="120" height="96" rx="13" />
          <rect x="-40" y="142" width="150" height="101" rx="13" />
          <rect x="133" y="142" width="126" height="101" rx="13" />
          <rect x="282" y="142" width="120" height="101" rx="13" />
          <rect x="-40" y="270" width="150" height="112" rx="13" />
          <rect x="133" y="270" width="126" height="112" rx="13" />
          <rect x="282" y="270" width="120" height="112" rx="13" />
          <rect x="-40" y="407" width="150" height="100" rx="13" />
          <rect x="133" y="407" width="126" height="100" rx="13" />
          <rect x="282" y="407" width="120" height="100" rx="13" />
          <rect
            x="133"
            y="142"
            width="126"
            height="101"
            rx="17"
            fill="#d1dfc8"
            className="dark:fill-emerald-900/40"
          />
          <path
            d="M116-30V710M270-30V710M-60 128H480M-60 257H480M-60 394H480M-60 520H480"
            fill="none"
            stroke="white"
            strokeWidth="12"
            className="dark:stroke-slate-700"
          />
          <path
            d="M112 343V257H270V128H337"
            fill="none"
            stroke="white"
            strokeWidth="16"
            strokeLinejoin="round"
            className="dark:stroke-slate-900"
          />
          <path
            d="M112 343V257H270V128H337"
            fill="none"
            stroke="#2464d2"
            className="dark:stroke-indigo-400"
            strokeWidth="6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx="112"
            cy="343"
            r="12"
            fill="white"
            stroke="white"
            className="dark:fill-slate-900 dark:stroke-slate-900"
          />
          <circle cx="112" cy="343" r="6" fill="#2464d2" stroke="none" className="dark:fill-indigo-400" />
          <circle
            cx="337"
            cy="128"
            r="21"
            fill="#2464d2"
            stroke="white"
            strokeWidth="5"
            className="dark:fill-indigo-400 dark:stroke-slate-900"
          />
          <circle cx="337" cy="128" r="6" fill="white" stroke="none" />
        </g>
        <path d="M0 360H520V640H0Z" fill="url(#login-map-fade)" />
        <defs>
          <linearGradient id="login-map-fade" x1="0" x2="0" y1="360" y2="640" gradientUnits="userSpaceOnUse">
            <stop stopColor="#edf1ed" stopOpacity="0" className="dark:[stop-color:#0f172a]" />
            <stop offset=".45" stopColor="#edf1ed" className="dark:[stop-color:#0f172a]" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 dark:border-white/10 dark:bg-slate-900/90 px-3 py-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        {t('Mỗi hành trình, một kết nối.')}
      </div>
      <div className="absolute bottom-9 left-8 right-8">
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-white dark:bg-slate-800 text-brand-600 dark:text-indigo-300">
          <Icon name="route" size={22} />
        </span>
        <p className="max-w-[260px] text-[29px] font-semibold leading-tight tracking-[-.04em] text-ink dark:text-slate-100">
          {t('Đi đâu tiếp theo?')}
        </p>
        <p className="mt-3 max-w-[250px] text-[13px] leading-6 text-slate-500 dark:text-slate-400">
          {t('Tìm đường, lưu hành trình và cập nhật giao thông cùng cộng đồng iMap.')}
        </p>
      </div>
    </aside>
  );
}

export function AuthPage() {
  const { isDark } = useTimeBasedMapLayer();
  const { language, setLanguage, t } = useI18n();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = t('Đăng nhập · iMap');
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  return (
    <div className={isDark ? 'dark' : ''}>
      <main
        className={`h-dvh overflow-y-auto bg-[#f6f7f9] text-ink dark:bg-slate-950 dark:text-slate-100 max-sm:bg-white dark:max-sm:bg-slate-900`}
      >
        <div className="mx-auto flex min-h-full max-w-[1120px] flex-col px-5 py-5 sm:px-8 sm:py-6">
          <header className="flex items-center justify-between gap-4">
            <a
              href="/"
              aria-label={t('iMap — về bản đồ')}
              className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 dark:focus-visible:ring-indigo-400/30"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white dark:bg-brand-500">
                <Icon name="directions" size={21} />
              </span>
              <span className="text-[23px] font-bold tracking-[-.06em]">
                iMap<span className="text-brand-600 dark:text-indigo-300">.</span>
              </span>
            </a>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="login-language-select">
                {t('Ngôn ngữ')}
              </label>
              <select
                id="login-language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'vi')}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-ink dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="vi">VI</option>
                <option value="en">EN</option>
              </select>
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition hover:text-brand-700 dark:hover:text-indigo-300"
              >
                <span aria-hidden="true">←</span> {t('Về bản đồ')}
              </a>
            </div>
          </header>
          <div className="flex flex-1 items-center justify-center py-6 sm:py-6">
            <div className="grid w-full max-w-[960px] overflow-hidden rounded-[32px] border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900 p-2 shadow-[0_16px_60px_-30px_rgba(23,43,67,0.25)] dark:shadow-[0_16px_60px_-30px_rgba(0,0,0,0.8)] max-sm:border-0 max-sm:p-0 max-sm:shadow-none md:min-h-[520px] md:grid-cols-[1fr_.92fr]">
              <section
                className="mx-auto w-full max-w-[440px] px-4 py-8 sm:px-9 sm:py-10 md:px-10 md:py-9"
                aria-label={t('Tài khoản iMap')}
              >
                <AccountForm showHeading />
                <a
                  href="/"
                  className="mt-6 flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 transition hover:text-brand-700 dark:hover:text-indigo-300"
                >
                  {t('Khám phá bản đồ trước')}
                  <Icon name="arrow-up-right" size={14} />
                </a>
              </section>
              <RouteIllustration />
            </div>
          </div>
          <footer className="pt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t('iMap · Cùng bạn trên mọi tuyến đường')}
          </footer>
        </div>
      </main>
    </div>
  );
}
