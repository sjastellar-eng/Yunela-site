import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isServerBuild = mode === 'server';
  return {
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
  };
});
