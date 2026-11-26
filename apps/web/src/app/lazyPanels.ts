import { lazyWithRecovery as lazy } from './lazyWithRecovery';

// Các panel chỉ tải mã khi người dùng mở, để lần tải đầu chỉ gồm bản đồ và thanh công cụ.
export const PlaceAssistantPanel = lazy(() =>
  import('../features/place-assistant/components/PlaceAssistantPanel').then((module) => ({
    default: module.PlaceAssistantPanel,
  })),
);
export const AuthPanel = lazy(() =>
  import('../features/auth/components/AuthPanel').then((module) => ({ default: module.AuthPanel })),
);
export const RoutePanel = lazy(() =>
  import('../features/routing/components/RoutePanel').then((module) => ({ default: module.RoutePanel })),
);
export const MultiStopPanel = lazy(() =>
  import('../features/multi-stop/components/MultiStopPanel').then((module) => ({
    default: module.MultiStopPanel,
  })),
);
export const SavedRoutesPanel = lazy(() =>
  import('../features/my-routes/components/SavedRoutesPanel').then((module) => ({
    default: module.SavedRoutesPanel,
  })),
);
export const PlacePanel = lazy(() =>
  import('../features/places/components/PlacePanel').then((module) => ({ default: module.PlacePanel })),
);
export const TrafficReportPanel = lazy(() =>
  import('../features/traffic/components/TrafficReportPanel').then((module) => ({
    default: module.TrafficReportPanel,
  })),
);
