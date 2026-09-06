import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const target = mode === 'firefox' ? 'firefox' : 'chrome';

  return {
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      target: 'es2022',
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
          content: resolve(__dirname, 'src/content/index.ts')
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          format: 'es'
        }
      }
    }
  };
});
