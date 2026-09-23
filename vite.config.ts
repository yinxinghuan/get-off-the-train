import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const GUEST_SHELL_SRC = 'https://images.aiwaves.tech/alteru/guest-shell.js'

function stripAlteruGuestShell(mode: string): Plugin {
  return {
    name: 'strip-alteru-guest-shell',
    apply: 'build',
    transformIndexHtml(html) {
      if (mode !== 'crazygames') return html
      const pattern = new RegExp(
        `\\s*<script\\s+src=["']${GUEST_SHELL_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>\\s*`,
        'gi',
      )
      return html.replace(pattern, '\n')
    },
  }
}

export default defineConfig(({ mode }) => ({
  // Relative base so the bundle loads inside a Crazy Games (or Pages) iframe
  // regardless of the host path.
  base: './',
  plugins: [react(), stripAlteruGuestShell(mode)],
  css: { preprocessorOptions: { less: { javascriptEnabled: true } } },
  build: {
    outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist',
    emptyOutDir: true,
  },
}))
