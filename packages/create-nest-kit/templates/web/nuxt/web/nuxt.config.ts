import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['shadcn-nuxt'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // A single-page app: `bun run generate` writes static files to .output/public, for any static host.
  ssr: false,
  // The API's .env allows this origin (WEB_APP_URL, CORS_ORIGINS); Nuxt's default 3000 is the API's port.
  devServer: { port: 5173 },
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
})
