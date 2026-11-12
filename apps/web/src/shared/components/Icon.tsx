import type { SVGProps } from 'react';

export type IconName =
  | 'sparkles'
  | 'arrow-up-right'
  | 'bookmark'
  | 'car'
  | 'check'
  | 'chevron-down'
  | 'close'
  | 'compass'
  | 'current-location'
  | 'directions'
  | 'globe'
  | 'layers'
  | 'menu'
  | 'motorcycle'
  | 'multi-stop'
  | 'plus'
  | 'minus'
  | 'moon'
  | 'search'
  | 'traffic'
  | 'upload'
  | 'swap'
  | 'clock'
  | 'road'
  | 'pin'
  | 'camera'
  | 'trash'
  | 'heart'
  | 'more'
  | 'send'
  | 'route'
  | 'refresh'
  | 'parking'
  | 'cafe'
  | 'shop'
  | 'hospital'
  | 'close-circle'
  | 'star'
  | 'fuel'
  | 'ev'
  | 'hotel'
  | 'restaurant'
  | 'museum'
  | 'bus'
  | 'pharmacy'
  | 'atm'
  | 'attraction'
  | 'share'
  | 'link'
  | 'phone'
  | 'filter'
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'wifi'
  | 'snowflake'
  | 'info'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-left'
  | 'warning';

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Nội dung SVG tĩnh (do dự án viết sẵn) của từng biểu tượng, hệ tọa độ 24×24. */
const shapes: Record<IconName, string> = {
  sparkles:
    '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />',
  'arrow-up-right': '<path d="M7 17 17 7" /><path d="M8 7h9v9" />',
  bookmark: '<path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.6L6 21V4.75Z" />',
  car: '<path d="m5 10 1.6-4.1A2 2 0 0 1 8.5 4.6h7a2 2 0 0 1 1.9 1.3L19 10" /><path d="M3.8 10.4A2 2 0 0 1 5.6 9h12.8a2 2 0 0 1 1.8 1.4l1 4.1a1.7 1.7 0 0 1-1.7 2.1H4.5a1.7 1.7 0 0 1-1.7-2.1l1-4.1Z" /><path d="M6 17.5v2M18 17.5v2M6 13h.01M18 13h.01" />',
  check: '<path d="m5 12.5 4.5 4.5L19 7" />',
  'chevron-down': '<path d="m6 9 6 6 6-6" />',
  close: '<path d="m6 6 12 12M18 6 6 18" />',
  compass: '<circle cx="12" cy="12" r="9" /><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5 5-2.2Z" />',
  'current-location':
    '<circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.1" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />',
  directions:
    '<path d="m12 2.7 8.3 8.3a1.4 1.4 0 0 1 0 2L12 21.3a1.4 1.4 0 0 1-2 0L1.7 13a1.4 1.4 0 0 1 0-2L10 2.7a1.4 1.4 0 0 1 2 0Z" /><path d="M8 12h7M12 8l4 4-4 4" />',
  globe: '<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" />',
  menu: '<path d="M4 6h16M4 12h16M4 18h16" />',
  motorcycle:
    '<circle cx="6" cy="16.5" r="3.1" /><circle cx="18" cy="16.5" r="3.1" /><path d="m6 16.5 3.2-6h4.2l4.6 6.2M12.4 10.5l-1.3-3H8M14 7.5h3.2l1.2 2.2M9.2 10.5l3.1 6" />',
  'multi-stop':
    '<circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 6h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H8" /><path d="m11 12-3 3 3 3" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  minus: '<path d="M5 12h14" />',
  moon: '<path d="M20.6 15.1A8.7 8.7 0 0 1 8.9 3.4 8.8 8.8 0 1 0 20.6 15.1Z" />',
  search: '<circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 5 5" />',
  traffic: '<path d="m12 3 9 16H3l9-16Z" /><path d="M12 9v4M12 16.5h.01" />',
  upload:
    '<path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 14v4.25A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V14" />',
  swap: '<path d="m7 7 3-3 3 3M10 4v15M17 17l-3 3-3-3M14 20V5" />',
  clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" />',
  road: '<path d="M8 3 4 21M16 3l4 18M12 5v3M12 12v3M12 19v2" />',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" />',
  camera:
    '<path d="M4 7h3l1.3-2h7.4L17 7h3a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 7Z" /><circle cx="12" cy="13" r="3.4" />',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />',
  heart:
    '<path d="M20.8 8.8c0 4.1-8.8 10.4-8.8 10.4S3.2 12.9 3.2 8.8a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z" />',
  more: '<circle cx="5" cy="12" r=".8" /><circle cx="12" cy="12" r=".8" /><circle cx="19" cy="12" r=".8" />',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" />',
  route:
    '<circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" />',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 12-2L20 9M4 15l2.5 2a7 7 0 0 0 12-2" />',
  parking: '<circle cx="12" cy="12" r="9" /><path d="M10 17V7h3.5a3 3 0 0 1 0 6H10" />',
  cafe: '<path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9ZM17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 4v2M11 4v2M15 4v2" />',
  shop: '<path d="M4 9h16l-1.2-5H5.2L4 9ZM5 9v11h14V9M9 20v-6h6v6" />',
  hospital: '<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M12 7v8M8 11h8" />',
  'close-circle': '<circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" />',
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.6l6-.9L12 3.2Z" />',
  fuel: '<path d="M5 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M4 20h11M5 10h9M14 8h2.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 3 0V8l-2.5-2.5" />',
  ev: '<path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" />',
  hotel: '<path d="M3 20V6M3 16h18v4M21 16v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="12" r="1.8" />',
  restaurant: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3 4-3 7v3h3" />',
  museum: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18M3 9.5h18" />',
  bus: '<rect x="4" y="3.5" width="16" height="14" rx="3" /><path d="M4 11h16M7.5 17.5V20M16.5 17.5V20M8 14.2h.01M16 14.2h.01" />',
  pharmacy: '<rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />',
  atm: '<rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5h.01M17.5 14.5h.01" />',
  attraction:
    '<path d="M12 21V9M12 9c0-2.5-1.8-4.5-4.5-4.5C7.5 7.3 9.3 9 12 9Zm0 0c0-2.5 1.8-4.5 4.5-4.5C16.5 7.3 14.7 9 12 9ZM5 21h14M7.5 21c.5-3 2-5 4.5-5s4 2 4.5 5" />',
  share:
    '<circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="m8.1 10.8 7.8-3.6M8.1 13.2l7.8 3.6" />',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.6" /><path d="M11 18.5h2" />',
  filter: '<path d="M4 6h16M7 12h10M10 18h4" />',
  sun: '<circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.8 3.8 0 0 1-.5 7.5H7Z" />',
  rain: '<path d="M7 15a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 7.5a3.8 3.8 0 0 1-.5 7.5H7ZM8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" />',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0M12 19.5h.01" />',
  snowflake:
    '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />',
  info: '<circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8h.01" />',
  'chevron-left': '<path d="m15 6-6 6 6 6" />',
  'chevron-right': '<path d="m9 6 6 6-6 6" />',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6" />',
  warning: '<path d="M12 3.5 21.5 20h-19L12 3.5Z" /><path d="M12 10v4.5M12 17.2h.01" />',
};

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...common}
      {...props}
      dangerouslySetInnerHTML={{ __html: shapes[name] }}
    />
  );
}

/** Chuỗi SVG của biểu tượng, dùng cho marker Leaflet (divIcon) nằm ngoài cây React. */
export function iconSvg(name: IconName, size = 16): string {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes[name]}</svg>`;
}
