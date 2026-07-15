import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Relative base so the built site works from any subfolder / static host.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    // Portfolio + standalone games + admin.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        fight: resolve(__dirname, 'fight.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
