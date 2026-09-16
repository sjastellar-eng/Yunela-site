import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isServerBuild = process.env.BUILD_TARGET === 'server';

export default defineConfig({
  plugins: isServerBuild ? [] : [react()],
  build: isServerBuild
    ? {
        ssr: true,
        outDir: 'dist-server',
        emptyOutDir: true,
        rollupOptions: {
          input: 'src/api/f3-runtime.ts',
          external: [/^node:/, 'better-sqlite3'],
          output: { entryFileNames: 'f3-runtime.js' },
        },
      }
    : undefined,
});
