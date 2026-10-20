import { defineConfig } from '@waldjs/cli'

export default defineConfig({
  outDir: 'dist',
  base: '/',
  vite: {
    // This benchmark site gets the WaldJS packages as workspace links, and
    // Vite always bundles linked packages into the SSR build. A normal
    // `npm install` puts them in node_modules, where Vite leaves them
    // external. Mirror that here so the benchmark measures what users run
    // (without it, gray-matter + marked are re-bundled on every build).
    ssr: { external: ['@waldjs/runtime', '@waldjs/content'] },
  },
})
