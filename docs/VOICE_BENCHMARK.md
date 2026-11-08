# Kiểm thử voice tiếng Anh

Chạy ngày 09/11/2026 bằng nhận dạng thực sự, không mock transcript. Đây là benchmark phát triển nhỏ, không phải chứng nhận độ chính xác thực địa.

## Thiết lập

- Model: `Systran/faster-whisper-base.en`, engine faster-whisper 1.2.1, CTranslate2 CPU int8, 4 threads, beam5, temperature0, language=en. Không prompt mẫu câu/hotword, không lấy đáp án để gợi ý recognizer.
- 12 câu độc lập × 4 điều kiện = 48 audio. macOS `say`: Samantha (US), Daniel (UK); tốc độ 175 hoặc 240 từ/phút. `afconvert` mono PCM16 16kHz. Nhiễu trắng Gaussian SNR10dB, seed42; SNR theo toàn tín hiệu kể cả silence. Audio/model ở `~/.cache/imap-voice`, không đưa vào Git.
- Có fuel, school, hospital, toilets, cafe, parking, pharmacy, ATM, bus, train, library và “Find the station” mơ hồ. Ba câu chứa giới hạn 2km bán kính, 5 phút đi thêm, 1km đi thêm. Mọi câu được parse không có ngữ cảnh.
- WER thô: edit distance từ sau lowercase, bỏ apostrophe và punctuation, chia số từ reference. Không chuẩn hóa `two kilometers` = `2 km`, nên WER có cả khác biệt trình bày đúng nghĩa. Không trừ các lỗi này để làm đẹp điểm.
- Điểm category và all-slots: so với ground truth định trước (category, radius, extraDistance, extraDuration), không dùng chính parser trên reference làm đáp án.

## Kết quả

| Điều kiện | Mẫu | WER thô | Đúng category | Đúng cả 4 slots | Mean inference |
|---|---:|---:|---:|---:|---:|
| US sạch 175 wpm | 12 | 6,85% | 12/12 | 12/12 | 0,975s |
| UK sạch 175 wpm | 12 | 5,48% | 12/12 | 12/12 | 1,103s |
| US nhanh 240 wpm | 12 | 9,59% | 12/12 | 12/12 | 0,713s |
| US + nhiễu trắng 10dB | 12 | 9,59% | 12/12 | 12/12 | 0,738s |

Inference timing đã bao gồm thực thi lazy segment iterator; không gồm tải model, TTS, network, resample hay browser capture. Các lần sau có thể khác theo CPU/voice hệ điều hành. Kết quả raw và transcript từng mẫu: [benchmark-results.json](voice/benchmark-results.json).

Lỗi có ý nghĩa: `at most` → `utmost` (nhanh) / `its most` (nhiễu); `Find a bus stop` → `time to bus stop`. Bổ sung parser nhận giới hạn dạng `1 km extra` và hyphen `1-kilometer extra`; có regression test. Đây là sửa sau benchmark ban đầu; điểm all-slots ở bảng là parser cuối trên chính tập đã xem, **không phải tập held-out**. Cần tập người nói mới để đo khả năng tổng quát. “Find the station” trả unknown, hỏi lại; unknown đúng cũng tính là category đúng.

## Chạy lại

```sh
python3.12 -m venv ~/.cache/imap-voice/venv
~/.cache/imap-voice/venv/bin/pip install faster-whisper==1.2.1
~/.cache/imap-voice/venv/bin/python scripts/voice/benchmark.py
npm run build -w @routetwin/shared
node node_modules/tsx/dist/cli.mjs scripts/voice/evaluate.ts
```

Cần macOS có Samantha/Daniel, Internet cho lần tải model. Lưu ý script tạo lại JSON sẽ ghi đè kết quả cũ; chạy evaluate sau đó để bổ sung slots/summary.

## Những gì chưa được chứng minh

Chưa có tiếng Anh giọng Việt/người thật, micro điện thoại, tiếng xe/gió thật, lỗi mạng, dataset độc lập hay so sánh Anh–Việt. Không có cơ sở kết luận tiếng Anh chính xác hơn tiếng Việt hoặc ngang Google Maps từ bài đo này. Local base.en **không phải model Cloudflare**; chưa có Cloudflare token nên chưa đo ASR của endpoint production. Test provider HTTP dùng response fixture chỉ chứng minh hợp đồng, xử lý lỗi/quota; test browser SpeechRecognition fixture chỉ chứng minh luồng bản nháp không tự tìm kiếm.

Nên bổ sung trước bảo vệ đồ án: 5 người, mỗi người 20 câu mới (100 audio, cả giọng Việt nói Anh), 2 thiết bị và 2 môi trường, chấm WER/slot/clarify/latency riêng; không chỉnh parser trên tập dùng báo cáo cuối. Tuyệt đối kiểm tra chữ nhận dạng trước dùng khi đang lái xe; UX hiện chỉ hỗ trợ bản nháp, không điều khiển xe.
