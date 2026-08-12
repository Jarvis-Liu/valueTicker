// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase'
  ],

  devtools: {
    enabled: true
  },

  runtimeConfig: {
    // Cloudflare 行情代理根地址，仅供 Nitro 正式行情 API 与测试接口读取，不暴露给客户端。
    cloudflareWorkerUrl: process.env.CLOUDFLARE_WORKER_URL ?? '',
    public: {
      // 迁移观察期回滚开关；仅暴露布尔值，不包含任何上游凭据。
      serverKlineCacheEnabled: process.env.SERVER_KLINE_CACHE_ENABLED !== 'false'
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/auth/callback',
      exclude: []
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    },
    types: false
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css'
  }
})
