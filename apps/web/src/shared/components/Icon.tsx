import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'arrow-up-right' | 'bookmark' | 'car' | 'check' | 'chevron-down' | 'close'
  | 'compass' | 'current-location' | 'directions' | 'globe' | 'layers' | 'menu'
  | 'motorcycle' | 'multi-stop' | 'plus' | 'minus' | 'search' | 'sparkles'
  | 'traffic' | 'upload' | 'swap' | 'clock' | 'road' | 'pin' | 'bike'
  | 'walk' | 'camera' | 'trash' | 'heart' | 'more' | 'send' | 'route'
  | 'parking' | 'cafe' | 'shop' | 'hospital' | 'close-circle';

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const shapes: Record<IconName, ReactNode> = {
    'arrow-up-right': <><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>,
    bookmark: <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.6L6 21V4.75Z"/>,
    car: <><path d="m5 10 1.6-4.1A2 2 0 0 1 8.5 4.6h7a2 2 0 0 1 1.9 1.3L19 10"/><path d="M3.8 10.4A2 2 0 0 1 5.6 9h12.8a2 2 0 0 1 1.8 1.4l1 4.1a1.7 1.7 0 0 1-1.7 2.1H4.5a1.7 1.7 0 0 1-1.7-2.1l1-4.1Z"/><path d="M6 17.5v2M18 17.5v2M6 13h.01M18 13h.01"/></>,
    check: <path d="m5 12.5 4.5 4.5L19 7"/>,
    'chevron-down': <path d="m6 9 6 6 6-6"/>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5 5-2.2Z"/></>,
    'current-location': <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.1"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    directions: <><path d="m12 2.7 8.3 8.3a1.4 1.4 0 0 1 0 2L12 21.3a1.4 1.4 0 0 1-2 0L1.7 13a1.4 1.4 0 0 1 0-2L10 2.7a1.4 1.4 0 0 1 2 0Z"/><path d="M8 12h7M12 8l4 4-4 4"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    motorcycle: <><circle cx="6" cy="16.5" r="3.1"/><circle cx="18" cy="16.5" r="3.1"/><path d="m6 16.5 3.2-6h4.2l4.6 6.2M12.4 10.5l-1.3-3H8M14 7.5h3.2l1.2 2.2M9.2 10.5l3.1 6"/></>,
    'multi-stop': <><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H8"/><path d="m11 12-3 3 3 3"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    search: <><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></>,
    sparkles: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
    traffic: <><path d="m12 3 9 16H3l9-16Z"/><path d="M12 9v4M12 16.5h.01"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v4.25A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V14"/></>,
    swap: <><path d="m7 7 3-3 3 3M10 4v15M17 17l-3 3-3-3M14 20V5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></>,
    road: <><path d="M8 3 4 21M16 3l4 18M12 5v3M12 12v3M12 19v2"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></>,
    bike: <><circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="m5.5 16.5 4-7h3l3 7H9.5M11 7h3M16 8l2 1"/></>,
    walk: <><circle cx="14" cy="4.5" r="1.8"/><path d="m12 8-2.5 4L7 14M12 8l3 3 3 1M10 12l2 3-1 5M13 14l3 3 3 1"/></>,
    camera: <><path d="M4 7h3l1.3-2h7.4L17 7h3a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 7Z"/><circle cx="12" cy="13" r="3.4"/></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></>,
    heart: <path d="M20.8 8.8c0 4.1-8.8 10.4-8.8 10.4S3.2 12.9 3.2 8.8a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z"/>,
    more: <><circle cx="5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="19" cy="12" r=".8"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>,
    parking: <><circle cx="12" cy="12" r="9"/><path d="M10 17V7h3.5a3 3 0 0 1 0 6H10"/></>,
    cafe: <><path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9ZM17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 4v2M11 4v2M15 4v2"/></>,
    shop: <><path d="M4 9h16l-1.2-5H5.2L4 9ZM5 9v11h14V9M9 20v-6h6v6"/></>,
    hospital: <><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M12 7v8M8 11h8"/></>,
    'close-circle': <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></>,
};

export function Icon({ name, size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common} {...props}>{shapes[name]}</svg>;
}
