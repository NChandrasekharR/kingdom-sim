import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: Number(process.env.PORT) || 5174,
  },
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        landing: new URL('./landing.html', import.meta.url).pathname,
      },
    },
  },
});
