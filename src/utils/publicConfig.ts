import { readStore, removeStore, writeStore } from './storage'
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
  return readStore(STORAGE_KEY_ADMIN) === 'true'
}

export function setAdminStored(authed: boolean) {
  if (authed)
    writeStore(STORAGE_KEY_ADMIN, 'true')

  else
    removeStore(STORAGE_KEY_ADMIN)
}

// ---------- 访客只读配置缓存 ----------

export interface ViewerCache {
  data: Category[]
  settings: Settings
  updatedAt?: string
}

export function loadViewerCache(): ViewerCache | undefined {
  const raw = readStore(STORAGE_KEY_VIEWER)
  if (!raw)
    return undefined

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.data) || parsed.data.length === 0 || !parsed?.settings)
      throw new Error('viewer_config 数据格式异常')

    return parsed as ViewerCache
  }
  catch {
    // 缓存损坏时清掉，避免访客白屏
    removeStore(STORAGE_KEY_VIEWER)
    return undefined
  }
}

export function saveViewerCache(cache: ViewerCache) {
  // 写失败（配额不足 / 存储被禁）静默忽略：仅影响下次首屏速度，不影响功能
  writeStore(STORAGE_KEY_VIEWER, JSON.stringify(cache))
}
