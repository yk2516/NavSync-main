/**
 * 壁纸文件夹（File System Access API）
 *
 * 目录句柄不能存进 localStorage（不是可序列化字符串），所以放 IndexedDB。
 * 页面刷新后重新读取句柄时权限会变成 'prompt'，需要一次用户手势才能重新授权
 * —— 小风车点击正好提供了这个手势，所以换图流程能自然跑通。
 */

const DB_NAME = 'navsync-wallpaper'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'wallpaper-dir'

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i

export function isFolderPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbPut(value: any): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(): Promise<any> {
  try {
    const db = await openDb()
    const value = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return value
  }
  catch {
    return undefined
  }
}

async function idbDelete(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
    db.close()
  }
  catch {
    // 忽略：清不掉也不影响功能
  }
}

/**
 * 弹出文件夹选择器（需要用户手势）
 *
 * 注意这里分成两段 try：**「用户取消」和「句柄存不进 IndexedDB」必须区分开**。
 * 早先写成一个大 try 把两者都 catch 成「返回 undefined」，后果是：
 * 隐私模式（IndexedDB 不可用）下用户选完文件夹，调用方 `if (!handle) return`
 * 直接静默返回 —— 界面毫无反应，也没有任何提示，看起来像按钮坏了。
 *
 * 句柄持久化只是为了「刷新后还能自动恢复」，失败不该让整个操作失败：
 * 本次会话内句柄依然可用，只是刷新后需要重新选一次
 * （与 `setAdminStored` 里「隐私模式下 localStorage 不可写，本次会话内仍可用」的处理一致）。
 */
export async function pickWallpaperDirectory(): Promise<any | undefined> {
  if (!isFolderPickerSupported())
    return undefined

  let handle: any
  try {
    handle = await (window as any).showDirectoryPicker({ id: 'navsync-wallpaper', mode: 'read' })
  }
  catch {
    // 用户取消（AbortError），或浏览器直接拒绝
    return undefined
  }

  try {
    await idbPut(handle)
  }
  catch {
    // 忽略：只影响下次刷新能否自动恢复，不影响本次使用
  }

  return handle
}

export async function loadWallpaperDirectory(): Promise<any | undefined> {
  return await idbGet()
}

export async function forgetWallpaperDirectory(): Promise<void> {
  await idbDelete()
}

/**
 * 确保句柄有读权限。权限是 'prompt' 时会弹一次授权，必须在用户手势里调用。
 */
export async function ensureReadPermission(handle: any): Promise<boolean> {
  if (!handle)
    return false
  try {
    if (typeof handle.queryPermission === 'function') {
      const state = await handle.queryPermission({ mode: 'read' })
      if (state === 'granted')
        return true
    }
    if (typeof handle.requestPermission === 'function') {
      const state = await handle.requestPermission({ mode: 'read' })
      return state === 'granted'
    }
    return true
  }
  catch {
    return false
  }
}

/** 递归列出文件夹内的图片文件（限制深度与数量，避免大目录卡死） */
export async function listImagesInDirectory(handle: any, maxFiles = 400, depth = 0): Promise<File[]> {
  const result: File[] = []
  if (!handle || depth > 3)
    return result

  try {
    for await (const entry of handle.values()) {
      if (result.length >= maxFiles)
        break
      if (entry.kind === 'file' && IMAGE_EXT.test(entry.name)) {
        try {
          result.push(await entry.getFile())
        }
        catch {
          // 单个文件读不了就跳过
        }
      }
      else if (entry.kind === 'directory') {
        const nested = await listImagesInDirectory(entry, maxFiles - result.length, depth + 1)
        result.push(...nested)
      }
    }
  }
  catch {
    // 目录不可读
  }
  return result
}
