/* eslint import/no-extraneous-dependencies: "off" */

import { defineConfig, loadEnv, type ConfigEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Access your env var
  const serverURL = env.VITE_SERVER_URL;

  return defineConfig({
    plugins: [react()],
    server: {
      port: 4530,
      proxy: {
        '/api': serverURL ? serverURL : 'http://localhost:8000',
        '/socket.io': {
          target: serverURL ? serverURL.replace(/^http/, 'ws') : 'ws://localhost:8000',
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
  });
};
