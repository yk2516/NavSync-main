import type { Category, Settings } from '@/types'

/**
 * 站长 / 访客身份与「访客只读配置缓存」
 *
 * 设计要点：
 * - 站长（admin）标记只会在服务端校验口令通过后写入，页面加载时还会再复验一次，
 *   因此单纯手工改 localStorage 伪造标记在下次加载就会被清掉；
 * - 访客读到的云端配置缓存在独立 key 里，不污染站长的本地配置键（cache / settings）。
 */

const STORAGE_KEY_ADMIN = 'admin_authed'
const STORAGE_KEY_VIEWER = 'viewer_config'

// ---------- 站长标记 ----------

export function isAdminStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_ADMIN) === 'true'
  }
  catch {
    return false
  }
}

export function setAdminStored(authed: boolean) {
  try {
    if (authed)
      localStorage.setItem(STORAGE_KEY_ADMIN, 'true')

    else
      localStorage.removeItem(STORAGE_KEY_ADMIN)
  }
  catch {
    // 隐私模式下 localStorage 不可写，忽略即可（本次会话内仍可用内存态）
  }
}

// ---------- 访客只读配置缓存 ----------

export interface ViewerCache {
  data: Category[]
  settings: Settings
  updatedAt?: string
}

export function loadViewerCache(): ViewerCache | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VIEWER)
    if (!raw)
      return undefined

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.data) || parsed.data.length === 0 || !parsed?.settings)
      throw new Error('viewer_config 数据格式异常')

    return parsed as ViewerCache
  }
  catch {
    // 缓存损坏时清掉，避免访客白屏
    try {
      localStorage.removeItem(STORAGE_KEY_VIEWER)
    }
    catch {}
    return undefined
  }
}

export function saveViewerCache(cache: ViewerCache) {
  try {
    localStorage.setItem(STORAGE_KEY_VIEWER, JSON.stringify(cache))
  }
  catch {
    // 配额不足等场景静默失败：仅影响下次首屏速度，不影响功能
  }
}

export function clearViewerCache() {
  try {
    localStorage.removeItem(STORAGE_KEY_VIEWER)
  }
  catch {}
}
