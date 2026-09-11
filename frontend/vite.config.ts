import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');
  // 팀 공유 API/DB는 Pi. Windows에서 172.30.1.15 가 안 되면 Tailscale IP 사용.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://100.126.240.26:8080';

  return {
    root: frontendRoot,
    base: './',
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
