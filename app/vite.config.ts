import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

const buildZeit = new Date().toISOString()
let gitCommit = 'unbekannt'
try {
  gitCommit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  // Ein exportierter Quellstand darf auch ohne .git-Verzeichnis gebaut werden.
}

export default defineConfig({
  plugins: [viteSingleFile()],
  base: './',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildZeit),
    __BUILD_COMMIT__: JSON.stringify(gitCommit),
  },
  test: { environment: 'happy-dom' },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
