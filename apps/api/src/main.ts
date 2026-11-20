import 'dotenv/config';
import { createApp } from './createApp.js';
import { env } from './config/env.js';

// Express 5 truyền lỗi (vd. cổng đã bị chiếm) vào callback thay vì ném ra: phải tự kiểm tra.
createApp().listen(env.API_PORT, (error?: Error) => {
  if (error) {
    console.error(`Không mở được cổng ${env.API_PORT}: ${error.message}`);
    process.exit(1);
  }
  console.log(`RouteTwin API tại http://localhost:${env.API_PORT}/api/health`);
  if (!env.VIETMAP_API_KEY)
    console.warn('VIETMAP_API_KEY chưa cấu hình; chỉ đường sẽ báo cần cấu hình API key.');
});
