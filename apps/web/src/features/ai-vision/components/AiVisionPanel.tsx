import { useEffect, useState } from 'react';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';

type AiVisionPanelProps = { onClose: () => void };

export function AiVisionPanel({ onClose }: AiVisionPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <FloatingPanel eyebrow="THỬ NGHIỆM" title="Phân tích ảnh giao thông" icon="sparkles" onClose={onClose}>
      <p className="mb-4 text-[12px] leading-5 text-slate-500">Tải ảnh tình huống giao thông lên để xem bố cục gửi ảnh và kết quả nhận diện.</p>
      <label htmlFor="traffic-image" className="group block cursor-pointer rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-5 text-center transition hover:border-brand-400 hover:bg-brand-50">
        {previewUrl ? <img src={previewUrl} alt="Ảnh tải lên xem trước" className="mx-auto max-h-48 w-full rounded-xl object-cover" /> : <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm"><Icon name="upload" size={23} /></span>}
        <span className="mt-3 block text-[12px] font-bold text-ink">{file ? file.name : 'Chọn ảnh từ thiết bị'}</span>
        <span className="mt-1 block text-[10px] text-slate-500">JPG, PNG hoặc WebP · tối đa 10 MB</span>
        <input id="traffic-image" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null;
          if (nextFile && nextFile.size > 10 * 1024 * 1024) {
            setFile(null);
            setFileError('Ảnh vượt quá giới hạn 10 MB. Hãy chọn ảnh nhỏ hơn.');
          } else {
            setFile(nextFile);
            setFileError('');
          }
          setSubmitted(false);
        }} />
      </label>
      {fileError && <p className="mt-2 text-[10px] font-medium text-red-600" role="alert">{fileError}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600"><Icon name="camera" size={14} />Nhận diện biển báo</span><p className="mt-1.5 text-[10px] text-slate-500">Biển báo đường phố</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600"><Icon name="traffic" size={14} />Nhận diện tình huống</span><p className="mt-1.5 text-[10px] text-slate-500">Ùn tắc và sự cố</p></div>
      </div>
      <div className="sticky bottom-0 z-20 -mx-5 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-1 pt-3">
        <button type="button" disabled={!file} onClick={() => setSubmitted(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700 disabled:bg-slate-300"><Icon name="sparkles" size={17} />Xem luồng phân tích</button>
      </div>
      {submitted && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3" role="status"><p className="text-[11px] font-bold text-amber-900">Giao diện nhận ảnh đã sẵn sàng</p><p className="mt-1 text-[10px] leading-4 text-amber-800">Để phân tích thực tế, cần kết nối backend và nhà cung cấp AI. Ảnh chưa được gửi đi.</p></div>}
      <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">Ảnh được giữ trong trình duyệt; thao tác phân tích hiện chưa gửi ảnh đến dịch vụ AI.</p>
    </FloatingPanel>
  );
}
