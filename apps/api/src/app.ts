import { createApp } from './createApp.js';

/**
 * Entry point cho Vercel (vercel.json trỏ vào file này): chỉ khởi tạo ứng dụng.
 * Chạy local dùng main.ts; mã khác import `createApp` từ createApp.ts để không tạo thêm một container.
 */
export default createApp();
