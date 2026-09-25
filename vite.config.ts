import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const GUEST_SHELL_SRC = 'https://images.aiwaves.tech/alteru/guest-shell.js'

function omitGuestMusic(mode: string): Plugin | null {
  if (mode === 'crazygames') return null
  return {
    name: 'omit-guest-music',
    enforce: 'pre',
    load(id) {
      if (id.indexOf('/src/audio/cgTracks') === -1) return null
      return 'export const loopUrl = ""; export const clearUrl = ""; export const missUrl = "";'
    },
  }
}

function crazyGamesIndexHtml(mode: string): Plugin {
  return {
    name: 'crazygames-index-html',
    apply: 'build',
    transformIndexHtml(html) {
      if (mode !== 'crazygames') return html
      const pattern = new RegExp(
        `\\s*<script\\s+src=["']${GUEST_SHELL_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>\\s*`,
        'gi',
      )
      return html
        .replace(pattern, '\n')
        .replace(/<html\b[^>]*>/i, '<html lang="en" class="cg-guest">')
        .replace(/<title>[\s\S]*?<\/title>/i, '<title>Get Off the Train!</title>')
        .replace(/<head>/i, '<head>\n    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />')
    },
  }
}

export default defineConfig(({ mode }) => ({
  // Relative base so the bundle loads inside a Crazy Games (or Pages) iframe
  // regardless of the host path.
  base: './',
  plugins: [omitGuestMusic(mode), react(), crazyGamesIndexHtml(mode)].filter((plugin): plugin is Plugin => plugin != null),
  css: { preprocessorOptions: { less: { javascriptEnabled: true } } },
  build: {
    outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist',
    emptyOutDir: true,
  },
}))
