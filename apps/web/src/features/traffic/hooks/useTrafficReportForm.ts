import type { TrafficImageAnalysisDto, TrafficImageAnalysisTask } from '@routetwin/shared';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { trafficApi, trafficPhotos } from '../api/trafficApi';
import { photoError } from '../domain/photoValidation';
import { SignedUrlCache } from '../services/SignedUrlCache';
import type { IncidentKind, IncidentSeverity, TrafficReportPanelProps, TrafficVehicleScope } from '../types';
/** Link ảnh Supabase có hạn 10 phút; dùng lại tối đa 9 phút để không đưa ra link sắp chết. */
const signedPhotoUrls = new SignedUrlCache((path) => trafficPhotos.signedUrl(path), 9 * 60_000);
/** Khoảng chờ tối thiểu (ms) giữa hai lần làm mới link ảnh, tránh lặp liên tục nếu đồng hồ lệch. */
const MIN_PHOTO_REFRESH_MS = 1_000;
/** Ảnh ký lỗi (mất mạng, Supabase trả null) thì thử lại sau ngần này (ms), hoặc ngay khi có mạng lại. */
const PHOTO_RETRY_MS = 30_000;
export function useTrafficReportForm({
  incidents,
  selectedPoint,
  isAuthenticated,
  accessToken,
  defaultVehicle,
  onSignIn,
  onReport,
  onClearance,
}: TrafficReportPanelProps) {
  const analysisRef = useRef<AbortController | null>(null);
  const { language, t } = useI18n();
  const [type, setType] = useState<IncidentKind>('traffic_jam');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [vehicleScope, setVehicleScope] = useState<TrafficVehicleScope>(defaultVehicle);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  /** Tăng lên khi link ảnh đang hiện sắp hết hạn, để ký lại dù danh sách ảnh không đổi. */
  const [photoUrlGeneration, setPhotoUrlGeneration] = useState(0);
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [imageAnalysis, setImageAnalysis] = useState<TrafficImageAnalysisDto | null>(null);
  const [analysisTask, setAnalysisTask] = useState<TrafficImageAnalysisTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyReportId, setBusyReportId] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    analysisRef.current?.abort();
    setAnalysisTask(null);
    setImageAnalysis(null);
    return () => analysisRef.current?.abort();
  }, [photo, accessToken]);
  useEffect(() => setVehicleScope(defaultVehicle), [defaultVehicle]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Chỉ chạy lại khi danh sách ảnh thật sự đổi (id + đường dẫn), không phải mỗi lần mảng incidents được tạo mới.
  const recentPhotoKey = incidents
    .slice(0, 8)
    .filter((incident) => incident.imagePath)
    .map((incident) => `${incident.id}\t${incident.imagePath}`)
    .join('\n');

  useEffect(() => {
    let current = true;
    let refreshTimer: number | undefined;
    let waitingForNetwork = false;
    const refresh = () => setPhotoUrlGeneration((generation) => generation + 1);
    const recentPhotos = recentPhotoKey ? recentPhotoKey.split('\n').map((line) => line.split('\t')) : [];
    if (!recentPhotos.length) {
      setPhotoUrls({});
      return () => {
        current = false;
      };
    }
    // Ký từng ảnh riêng: một ảnh lỗi không làm mất các ảnh còn lại.
    void Promise.all(
      recentPhotos.map(async ([id, imagePath]) => {
        const url = await signedPhotoUrls.get(imagePath!).catch(() => null);
        return [id!, url] as const;
      }),
    ).then((entries) => {
      if (!current) return;
      setPhotoUrls(
        Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))),
      );
      // Bảng mở lâu mà danh sách không đổi thì effect không tự chạy lại, nên tự hẹn lần chạy kế:
      // trước khi link đang hiện hết hạn, và sớm hơn nếu có ảnh ký lỗi (cache không nhớ lỗi nên sẽ ký lại).
      const failed = entries.some(([, url]) => !url);
      const refreshAt = signedPhotoUrls.refreshAt(recentPhotos.map(([, imagePath]) => imagePath!));
      const nextAt = Math.min(refreshAt ?? Infinity, failed ? Date.now() + PHOTO_RETRY_MS : Infinity);
      if (Number.isFinite(nextAt))
        refreshTimer = window.setTimeout(refresh, Math.max(MIN_PHOTO_REFRESH_MS, nextAt - Date.now()));
      if (failed) {
        window.addEventListener('online', refresh);
        waitingForNetwork = true;
      }
    });
    return () => {
      current = false;
      window.clearTimeout(refreshTimer);
      if (waitingForNetwork) window.removeEventListener('online', refresh);
    };
  }, [recentPhotoKey, photoUrlGeneration]);

  useEffect(() => {
    let current = true;
    void trafficApi
      .imageAnalysisReady()
      .then((status) => {
        if (current) setAiStatus(status.configured?.trafficImageAi ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (current) setAiStatus('unavailable');
      });
    return () => {
      current = false;
    };
  }, []);

  const selectPhoto = (file: File | undefined) => {
    if (!file) return;
    setActionMessage(null);
    setActionError(null);
    setImageAnalysis(null);
    const error = photoError(file);
    if (error) {
      setActionError(error);
      return;
    }
    setPhoto(file);
  };

  const analyzePhoto = async (task: TrafficImageAnalysisTask) => {
    if (!photo || (analysisRef.current && !analysisRef.current.signal.aborted)) return;
    if (!accessToken) {
      onSignIn();
      setActionError('Đăng nhập để dùng phân tích ảnh.');
      return;
    }
    const controller = new AbortController();
    analysisRef.current = controller;
    setAnalysisTask(task);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await trafficApi.analyzeImage(photo, task, accessToken, controller.signal);
      if (!controller.signal.aborted) setImageAnalysis(result);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setImageAnalysis(null);
      setActionError(cause instanceof Error ? cause.message : 'Không phân tích được ảnh.');
    } finally {
      if (analysisRef.current === controller) {
        analysisRef.current = null;
        if (!controller.signal.aborted) setAnalysisTask(null);
      }
    }
  };

  const applyIncidentSuggestion = () => {
    if (!imageAnalysis || imageAnalysis.task !== 'incident' || !imageAnalysis.trafficRelated) return;
    if (imageAnalysis.incidentType !== 'unknown') setType(imageAnalysis.incidentType);
    setNote(imageAnalysis.summary);
    setActionMessage('Đã điền loại sự cố và ghi chú. Mức độ vẫn theo lựa chọn thủ công của bạn.');
  };

  const submit = async () => {
    if (!selectedPoint || !isAuthenticated) return;
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await onReport(type, severity, vehicleScope, selectedPoint, note.trim(), photo);
      setNote('');
      setPhoto(null);
      setImageAnalysis(null);
      setActionMessage('Đã gửi báo cáo. Cảm ơn bạn đã cập nhật tình hình.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không gửi được báo cáo.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (id: string, state: 'clear' | 'still_active') => {
    setBusyReportId(id);
    setActionError(null);
    setActionMessage(null);
    try {
      await onClearance(id, state);
      setActionMessage(
        state === 'clear' ? 'Đã xác nhận tình hình đã thông thoáng.' : 'Đã xác nhận sự cố vẫn còn.',
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không cập nhật được xác minh.');
    } finally {
      setBusyReportId('');
    }
  };
  return {
    language,
    t,
    type,
    setType,
    severity,
    setSeverity,
    vehicleScope,
    setVehicleScope,
    note,
    setNote,
    photo,
    setPhoto,
    photoPreview,
    photoUrls,
    aiStatus,
    imageAnalysis,
    setImageAnalysis,
    analysisTask,
    busy,
    busyReportId,
    actionMessage,
    actionError,
    selectPhoto,
    analyzePhoto,
    applyIncidentSuggestion,
    submit,
    verify,
  };
}
