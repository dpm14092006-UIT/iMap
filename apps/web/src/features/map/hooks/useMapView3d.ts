import { useState } from 'react';

const STORAGE_KEY = 'imap-view-3d';

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Chế độ 3D (bản đồ nghiêng; dẫn đường xoay theo hướng đi). Mặc định 2D như trước; lựa chọn được ghi nhớ.
 */
export function useMapView3d() {
  const [view3d, setState] = useState(read);
  return {
    view3d,
    setView3d(value: boolean) {
      setState(value);
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      } catch {
        // Lựa chọn vẫn có hiệu lực trong phiên hiện tại.
      }
    },
  };
}
