import { useEffect, useState } from 'react';
import type { PickTarget } from '../../../features/routing/components/RoutePanel';
import { parseRouteShareLink } from '../../../features/routing/domain/routeShareLink';
import type { FeatureKey } from '../../types';

/** Mở bản đồ trống, trừ khi người dùng vào bằng liên kết chia sẻ tuyến. */
function initialPanel(): FeatureKey | null {
  return parseRouteShareLink(window.location.search) ? 'directions' : null;
}

/** Panel nào đang mở, chế độ chọn điểm trên bản đồ và bảng đăng nhập. */
export function usePanelState() {
  const [activePanel, setActivePanel] = useState<FeatureKey | null>(initialPanel);
  /** Panel nhiều điểm được giữ lại (ẩn) sau lần mở đầu để không mất danh sách điểm đang soạn. */
  const [hasOpenedMulti, setHasOpenedMulti] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  // Nhấn Esc để thoát chế độ chọn điểm trên bản đồ.
  useEffect(() => {
    if (!pickTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); // để panel không đóng theo cùng phím Esc
      setPickTarget(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pickTarget]);

  const openPanel = (key: FeatureKey | null) => {
    setActivePanel(key);
    if (key === 'multi') setHasOpenedMulti(true);
    setPickTarget(null);
  };

  return {
    activePanel,
    hasOpenedMulti,
    pickTarget,
    setPickTarget,
    authOpen,
    setAuthOpen,
    openPanel,
    closePanel: () => openPanel(null),
    /** Có bảng nào đang che bản đồ không. */
    panelOpen: activePanel !== null || authOpen,
  };
}

export type PanelState = ReturnType<typeof usePanelState>;
