/** Logo iMap: ô gradient indigo → teal với ghim bản đồ. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-gradient shadow-md shadow-indigo-900/25 ${className}`}
      role="img"
      aria-label="iMap"
    >
      <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
        <path
          d="M16 4.5c-5.3 0-9 3.9-9 9 0 6.6 9 14 9 14s9-7.4 9-14c0-5.1-3.7-9-9-9Z"
          fill="white"
          fillOpacity=".95"
        />
        <path
          d="M12.5 17.5v-3.2c0-1.9 1.4-3.3 3.3-3.3h2.7"
          fill="none"
          stroke="#4338ca"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="19.5" cy="11" r="2" fill="#0d9488" />
      </svg>
    </span>
  );
}
