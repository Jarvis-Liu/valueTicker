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
    // Cloudflare 行情代理根地址，仅供服务端测试接口读取，不暴露到客户端运行时配置。
    cloudflareWorkerUrl: process.env.CLOUDFLARE_WORKER_URL ?? ''
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
