import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry:    'src/index.tsx',
      name:     'GHHostelsWidget',
      fileName: () => 'widget.js',   // output always as widget.js (not widget.iife.js)
      formats:  ['iife'],
    },
    rollupOptions: {
      external: [],
    },
    minify:          true,
    sourcemap:       false,
    target:          'es2017',
    outDir:          'dist',
    // Keep bundle small — warn if > 45 KB
    chunkSizeWarningLimit: 45,
  },
})
