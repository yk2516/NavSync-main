<script setup lang="ts">
/**
 * 管理入口口令门
 *
 * 普通访客停在 /setting 时只会看到这一个输入框，
 * 云端同步、重置数据、导入导出等功能完全不会渲染出来。
 */
const cloudStore = useCloudStore()
const adminStore = useAdminStore()
const router = useRouter()

const verifying = ref(false)

// 口令由 cloudStore 统一校验（含错误次数统计与锁定倒计时），
// 校验通过后再授予站长身份，从而进入真正的设置页
watch(() => cloudStore.passwordAuthed, (authed) => {
  if (authed)
    adminStore.grant()
}, { immediate: true })

async function handleVerify() {
  if (verifying.value)
    return
  verifying.value = true
  try {
    await cloudStore.verifyPassword()
  }
  finally {
    verifying.value = false
  }
}

function goHome() {
  router.replace('/')
}
</script>

<template>
  <section px="md:60 lg:120" py-40>
    <div class="admin-gate" mx-auto max-w-440>
      <div mb-10 flex items-center gap-x-8 text-16>
        <span i-carbon:locked style="color: var(--primary-c);" />
        <span style="font-weight: bold;">管理入口</span>
      </div>
      <div mb-16 text-13 op-60>
        该区域仅站长可用，请输入管理口令。
      </div>

      <div flex gap-x-8>
        <n-input
          v-model:value="cloudStore.passwordInput"
          type="password"
          show-password-on="click"
          placeholder="请输入管理口令"
          :disabled="cloudStore.isLocked"
          flex-1
          @keydown.enter="handleVerify"
        />
        <n-button
          type="primary"
          text-color="#ffffff"
          :loading="verifying"
          :disabled="!cloudStore.passwordInput.trim() || cloudStore.isLocked"
          @click="handleVerify"
        >
          进入
        </n-button>
      </div>

      <div v-if="cloudStore.isLocked" mt-10 flex items-center gap-x-4 text-12 style="color: #d03050;">
        <span i-carbon:warning-alt />
        <span>尝试次数过多，已锁定 {{ cloudStore.formatLockTime(cloudStore.lockRemainingSec) }}</span>
      </div>
      <div v-else-if="cloudStore.passwordHint" mt-10 text-12 style="color: #d03050;">
        {{ cloudStore.passwordHint }}
      </div>

      <div mt-20 flex items-center gap-x-12>
        <n-button quaternary size="small" @click="goHome">
          返回首页
        </n-button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.admin-gate {
  padding: 24px 20px;
  border: 1px solid var(--setting-border-c, rgba(128, 128, 128, 0.25));
  border-radius: 6px;
}
</style>
