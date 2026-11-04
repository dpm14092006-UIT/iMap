import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
createApp().listen(env.API_PORT, () => {
  console.log(`RouteTwin API tại http://localhost:${env.API_PORT}/api/health`);
  if (!env.VIETMAP_API_KEY) console.warn('VIETMAP_API_KEY chưa cấu hình; chỉ đường sẽ báo cần cấu hình API key.');
});
