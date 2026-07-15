import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Relative base so the built site works from any subfolder / static host.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    // Two entries: the portfolio and the standalone game page.
    // The game's JS is only loaded when /play.html is visited.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
