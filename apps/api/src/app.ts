import type { Express } from 'express';
import { createApp } from './createApp.js';

/**
 * Entry point cho Vercel (vercel.json trỏ vào file này): chỉ khởi tạo ứng dụng.
 * Chạy local dùng main.ts; mã khác import `createApp` từ createApp.ts để không tạo thêm một container.
 *
 * GIỮ dòng import từ 'express' ở trên: preset Express của Vercel chỉ nhận file entry có import express,
 * thiếu nó thì build báo "No entrypoint found which imports express" và production đứng ở bản cũ
 * (đã xảy ra từ a8db088 tới khi sửa).
 */
const app: Express = createApp();
export default app;
