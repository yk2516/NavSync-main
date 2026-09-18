/**
 * localStorage 的安全访问层。
 *
 * 为什么需要：`localStorage` 并不总是可用 ——
 * 用户禁用站点数据（Chrome 下 `window.localStorage` 的 getter 本身抛 `SecurityError`）、
 * 隐私模式配额为 0、配额写满（`QuotaExceededError`）、企业策略禁用存储，
 * 这些情况下裸调用都会抛异常。
 *
 * 危险之处在于调用方往往把它和**业务请求**包在同一个 `try` 里，存储异常冒出去
 * 就被当成业务失败：`utils/cloud.ts` 的 `validatePassword()` 里
 * `setStoredPassword()` 抛错会被它自己的 catch 捕获，于是
 * **用户输对了口令，界面却提示「网络错误，请检查网络连接」**。
 * `stores/site.ts` / `stores/setting.ts` 的深监听写入也一样 ——
 * 每次改站点都会在控制台炸一次。
 *
 * 所以这里统一吞掉存储异常，语义与 `utils/publicConfig.ts` 里
 * `setAdminStored` / `saveViewerCache` 的既有处理保持一致：
 * **写失败只影响「下次打开还在不在」，不影响本次会话内继续用内存态**（见硬约定 28）。
 */
export function readStore(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  }
  catch {
    return ''
  }
}

/** @returns 是否真的写进去了（false 表示存储不可用，调用方可忽略） */
export function writeStore(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  }
  catch {
    return false
  }
}

export function removeStore(key: string) {
  try {
    localStorage.removeItem(key)
  }
  catch {
    // 存储不可用时无事可做：本来就没有可清理的内容
  }
}
