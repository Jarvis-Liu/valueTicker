<script setup lang="ts">
import {
  IconActivityHeartbeat,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconMail,
  IconShieldCheck
} from '@tabler/icons-vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const email = ref('')
const otp = ref('')
const codeSent = ref(false)
const sending = ref(false)
const verifying = ref(false)
const resendCountdown = ref(0)
const errorMessage = ref('')
let countdownTimer: number | null = null

const normalizedEmail = computed(() => email.value.trim())
const canVerify = computed(() => /^\d{6}$/.test(otp.value))

useHead({ title: '登录 · ValueTicker' })

watch(user, (nextUser) => {
  if (nextUser) void navigateTo('/', { replace: true })
}, { immediate: true })

watch(otp, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits !== value) otp.value = digits
})

onUnmounted(stopCountdown)

async function sendEmailOtp() {
  if (!normalizedEmail.value || sending.value || resendCountdown.value > 0) return

  sending.value = true
  errorMessage.value = ''

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail.value,
      options: {
        shouldCreateUser: true // 允许自动创建新用户
      }
    })
    if (error) throw error

    codeSent.value = true
    otp.value = ''
    startCountdown()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试'
  } finally {
    sending.value = false
  }
}

async function verifyEmailOtp() {
  if (!canVerify.value || verifying.value) return

  verifying.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail.value,
      token: otp.value,
      type: 'email'
    })
    if (error) throw error
    if (!data.session) throw new Error('验证码验证成功，但未能建立登录会话')

    await navigateTo('/', { replace: true })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '验证码无效或已过期，请重新输入'
  } finally {
    verifying.value = false
  }
}

function editEmail() {
  codeSent.value = false
  otp.value = ''
  errorMessage.value = ''
  stopCountdown()
  resendCountdown.value = 0
}

function startCountdown() {
  stopCountdown()
  resendCountdown.value = 60
  countdownTimer = window.setInterval(() => {
    resendCountdown.value -= 1
    if (resendCountdown.value <= 0) stopCountdown()
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer === null) return
  window.clearInterval(countdownTimer)
  countdownTimer = null
}
</script>

<template>
  <main class="relative grid min-h-screen place-items-center overflow-hidden bg-[#071c19] px-4 py-10 text-white">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(52,211,153,0.16),transparent_35%),radial-gradient(circle_at_85%_85%,rgba(15,118,110,0.18),transparent_35%)]" />
    <section class="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0d2b26]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
      <div class="flex items-center gap-3">
        <span class="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 text-[#08211d] shadow-lg shadow-emerald-950/30">
          <IconActivityHeartbeat
            :size="25"
            :stroke-width="2.2"
          />
        </span>
        <div>
          <h1 class="text-lg font-semibold tracking-wide">
            ValueTicker
          </h1>
          <p class="text-[11px] tracking-[0.18em] text-emerald-100/50">
            MARKET MONITOR
          </p>
        </div>
      </div>

      <div class="mt-8">
        <h2 class="text-2xl font-semibold">
          {{ codeSent ? '输入邮箱验证码' : '登录你的监测空间' }}
        </h2>
        <p class="mt-2 text-sm leading-6 text-emerald-50/60">
          {{ codeSent ? `我们已向 ${normalizedEmail} 发送 6 位验证码。` : '输入邮箱获取 6 位验证码。首次登录会自动创建独立的自选分组和提醒配置。' }}
        </p>
      </div>

      <form
        v-if="!codeSent"
        class="mt-7"
        @submit.prevent="sendEmailOtp"
      >
        <label
          for="login-email"
          class="text-xs font-semibold text-emerald-50/80"
        >邮箱地址</label>
        <div class="relative mt-2">
          <IconMail
            class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-200/55"
            :size="18"
          />
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="name@example.com"
            class="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-emerald-300/25 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
          >
        </div>

        <button
          type="submit"
          class="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 text-sm font-semibold text-[#08211d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="sending || !normalizedEmail"
        >
          {{ sending ? '正在发送…' : '获取验证码' }}
          <IconArrowRight
            v-if="!sending"
            :size="17"
          />
        </button>
      </form>

      <form
        v-else
        class="mt-7"
        @submit.prevent="verifyEmailOtp"
      >
        <label
          for="login-otp"
          class="text-xs font-semibold text-emerald-50/80"
        >6 位验证码</label>
        <div class="relative mt-2">
          <IconShieldCheck
            class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-200/55"
            :size="19"
          />
          <input
            id="login-otp"
            v-model="otp"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            autofocus
            placeholder="请输入 6 位数字"
            class="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-12 pr-4 text-center text-xl font-semibold tracking-[0.5em] text-white outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-white/25 hover:border-emerald-300/25 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
          >
        </div>

        <button
          type="submit"
          class="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 text-sm font-semibold text-[#08211d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="verifying || !canVerify"
        >
          {{ verifying ? '正在验证…' : '验证并登录' }}
          <IconCheck
            v-if="!verifying"
            :size="17"
          />
        </button>

        <div class="mt-4 flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-emerald-100/65 transition hover:text-white"
            @click="editEmail"
          >
            <IconArrowLeft :size="15" />
            修改邮箱
          </button>
          <button
            type="button"
            class="font-semibold text-emerald-200 transition hover:text-white disabled:cursor-not-allowed disabled:text-emerald-100/35"
            :disabled="sending || resendCountdown > 0"
            @click="sendEmailOtp"
          >
            {{ sending ? '正在发送…' : resendCountdown > 0 ? `${resendCountdown} 秒后可重发` : '重新发送验证码' }}
          </button>
        </div>
      </form>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-3.5 py-3 text-xs leading-5 text-rose-100"
      >
        {{ errorMessage }}
      </p>
    </section>
  </main>
</template>
