<script setup lang="ts">
import { IconActivityHeartbeat } from '@tabler/icons-vue'

const supabase = useSupabaseClient()
const route = useRoute()
const errorMessage = ref('')

useHead({ title: '正在登录 · ValueTicker' })

onMounted(completeSignIn)

async function completeSignIn() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    let { session } = data

    const queryCode = Array.isArray(route.query.code) ? route.query.code[0] : route.query.code
    if (!session && typeof queryCode === 'string' && queryCode) {
      const result = await supabase.auth.exchangeCodeForSession(queryCode)
      if (result.error) throw result.error
      session = result.data.session
    }

    if (!session) throw new Error('登录链接无效或已过期，请返回登录页重新发送')
    await navigateTo('/', { replace: true })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '无法完成登录'
  }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-[#071c19] px-4 text-white">
    <section class="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d2b26] p-7 text-center shadow-2xl shadow-black/30">
      <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-[#08211d]">
        <IconActivityHeartbeat
          :size="26"
          class="animate-pulse"
        />
      </span>
      <template v-if="!errorMessage">
        <h1 class="mt-5 text-lg font-semibold">
          正在完成登录
        </h1>
        <p class="mt-2 text-sm text-emerald-50/55">
          正在验证会话并加载你的监测配置…
        </p>
      </template>
      <template v-else>
        <h1 class="mt-5 text-lg font-semibold text-rose-100">
          登录未完成
        </h1>
        <p class="mt-2 text-sm leading-6 text-rose-100/70">
          {{ errorMessage }}
        </p>
        <NuxtLink
          to="/login"
          class="mt-5 inline-flex h-10 items-center rounded-xl bg-emerald-400 px-4 text-xs font-semibold text-[#08211d] hover:bg-emerald-300"
        >返回登录</NuxtLink>
      </template>
    </section>
  </main>
</template>
