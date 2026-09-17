import { getStoredPassword, validatePassword } from '@/utils/cloud'
import { isAdminStored, setAdminStored } from '@/utils/publicConfig'
import router from '@/router'

/**
 * 站长身份状态
 *
 * - isAdmin 为 true 时才允许看到/进入设置页（云端同步、重置、导入导出）
 * - 标记只在服务端口令校验通过后写入，且每次页面加载都会复验一次
 * - 普通访客：isAdmin 恒为 false，全程只读
 */
export const useAdminStore = defineStore('admin', () => {
  const isAdmin = ref(isAdminStored())
  const isVerifying = ref(false)
  const verified = ref(false)

  /** 停在 /setting 但没有站长身份 → 进入口令门模式 */
  const isGate = computed(() => router.currentRoute.value.name === 'setting' && !isAdmin.value)

  function grant() {
    isAdmin.value = true
    setAdminStored(true)
  }

  function revoke() {
    isAdmin.value = false
    setAdminStored(false)
  }

  /**
   * 用本地保存的口令向服务端复验一次
   * 目的是防止有人直接改 localStorage 伪造站长标记 —— 伪造的标记会在本次加载被清掉
   */
  async function verifyStored(): Promise<boolean> {
    if (verified.value)
      return isAdmin.value
    verified.value = true

    if (!isAdmin.value)
      return false

    const password = getStoredPassword()
    if (!password) {
      // 没有口令却带着站长标记 → 视为伪造
      revoke()
      return false
    }

    isVerifying.value = true
    const result = await validatePassword(password)
    isVerifying.value = false

    if (result.valid) {
      grant()
      return true
    }

    revoke()
    return false
  }

  /** 退出站长身份（同时清除同步口令，下次需重新输入） */
  function logout() {
    revoke()
  }

  return {
    isAdmin,
    isVerifying,
    isGate,
    grant,
    revoke,
    verifyStored,
    logout,
  }
})
