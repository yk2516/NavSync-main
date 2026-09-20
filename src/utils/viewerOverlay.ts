import { readStore, removeStore, writeStore } from './storage'
import type { Category, Group, Site } from '@/types'

/**
 * 访客本地编辑的「覆盖层」
 *
 * 背景：站长把配置放在云端 Gist，访客每次打开都会拉一份只读副本（`viewer_config`）。
 * 现在访客也能右键编辑站点、也能点「＋」添加站点，但**改动只留在自己浏览器里** ——
 * 不上传，也不下载。
 *
 * 为什么不直接存整份配置（快照），而要记「覆盖层」：
 * 快照会让访客从此跟丢站长的更新 —— 站长后来新增的站点他永远看不到。
 * 覆盖层只记录「访客动过的那几项」，每次仍以站长云端配置为底稿，
 * 于是访客既保住自己的改动，也能继续拿到站长的新增。
 *
 * 数据形状（很小，通常几百字节）：
 *   sites   : 站点标识 → 访客改过的字段（只存改过的键）
 *   removed : 被访客删掉的云端站点标识
 *   added   : 分组标识 → 访客新增的站点（追加在该分组末尾）
 *
 * ⚠️ 这里只做「访客视图」的叠加，**绝不写回 `cache`**（站长专属配置键）。
 *    否则访客的改动会被站长当成自己的配置上传到云端 —— 见 `stores/site.ts`
 *    里身份从访客切回站长时的摘除守卫。
 */

const STORAGE_KEY = 'viewer_edits'

/** 允许被覆盖的站点字段白名单：localStorage 里的东西一律按外部输入处理 */
const PATCH_KEYS = ['name', 'url', 'favicon', 'bgColor', 'iconPadding'] as const
type PatchKey = typeof PATCH_KEYS[number]

export interface ViewerOverlay {
  sites: Record<string, Partial<Site>>
  removed: string[]
  added: Record<string, Site[]>
}

export function emptyOverlay(): ViewerOverlay {
  return { sites: {}, removed: [], added: {} }
}

/**
 * 标识前缀。
 *
 * `k:` / `n:` 不是装饰 —— id 来自外部（导入的 JSON、云端配置），
 * 直接拿 `__proto__` 这类魔法键当对象键会碰到原型链，加前缀后键永远是普通字符串。
 */
export function siteKey(site: Site | undefined): string {
  const id = site?.id
  if (id !== undefined && id !== null && id !== '')
    return `k:${id}`

  // 兜底：理论上不会走到 —— 预设、站长新增、导入的数据都带 id。
  // 代价是访客改了名称/链接后这条覆盖会跟丢（下次打开退回云端值）。
  return `n:${site?.name ?? ''}|${site?.url ?? ''}`
}

export function groupKey(group: Group | undefined): string {
  const id = group?.id
  if (id !== undefined && id !== null && id !== '')
    return `k:${id}`
  return `n:${group?.name ?? ''}`
}

function isOverlayKey(key: string): boolean {
  return key.startsWith('k:') || key.startsWith('n:')
}

/** 只保留白名单字段并按类型清洗，避免脏 localStorage 把任意键送进渲染层 */
function sanitizePatch(input: unknown): Partial<Site> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return undefined

  const src = input as Record<string, unknown>
  const out: Partial<Site> = {}
  PATCH_KEYS.forEach((key: PatchKey) => {
    const value = src[key]
    if (key === 'iconPadding') {
      if (typeof value === 'number' && Number.isFinite(value))
        out.iconPadding = Math.min(Math.max(Math.round(value), 0), 20)
      return
    }
    if (typeof value === 'string')
      out[key] = value
  })
  return Object.keys(out).length ? out : undefined
}

/**
 * 访客新增的站点要原样存下来，所以除了白名单字段，还必须校验 `id`。
 *
 * `id` 必须是有限数字：覆盖层的「改 / 删」都以 `siteKey(id)` 定位，
 * id 不稳（缺失或每次加载重新生成）会让这些记录跟丢。拿不到合法 id 就整条丢弃 ——
 * 访客自己新增的站点一定带 id（`addSite` 里给的 `Date.now()`）。
 */
function sanitizeAddedSite(input: unknown): Site | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return undefined

  const id = (input as Record<string, unknown>).id
  if (typeof id !== 'number' || !Number.isFinite(id))
    return undefined

  const patch = sanitizePatch(input)
  // 名称与链接是必填项（弹窗里也拦了一道），缺一个就不是合法站点
  if (!patch?.name || !patch.url)
    return undefined

  // 顺序要紧：`id` 必须写在展开之后 —— `sanitizePatch` 的类型是 `Partial<Site>`，
  // 展开它会把 `id` 重新声明成可选，写在前面会被覆盖掉
  return { ...patch, id, name: patch.name, url: patch.url }
}

export function loadOverlay(): ViewerOverlay {
  const raw = readStore(STORAGE_KEY)
  if (!raw)
    return emptyOverlay()

  try {
    const parsed = JSON.parse(raw)
    const sites: Record<string, Partial<Site>> = {}
    if (parsed?.sites && typeof parsed.sites === 'object' && !Array.isArray(parsed.sites)) {
      Object.entries(parsed.sites as Record<string, unknown>).forEach(([key, value]) => {
        if (!isOverlayKey(key))
          return
        const patch = sanitizePatch(value)
        if (patch)
          sites[key] = patch
      })
    }

    const removed = Array.isArray(parsed?.removed)
      ? (parsed.removed as unknown[]).filter(
          (v): v is string => typeof v === 'string' && isOverlayKey(v),
        )
      : []

    const added: Record<string, Site[]> = {}
    if (parsed?.added && typeof parsed.added === 'object' && !Array.isArray(parsed.added)) {
      Object.entries(parsed.added as Record<string, unknown>).forEach(([key, value]) => {
        if (!isOverlayKey(key) || !Array.isArray(value))
          return
        const list = value.map(sanitizeAddedSite).filter((s): s is Site => !!s)
        if (list.length)
          added[key] = list
      })
    }

    return { sites, removed, added }
  }
  catch {
    // 覆盖层损坏时清掉即可：最坏结果是访客改动丢失、回到站长云端配置，不会白屏
    removeStore(STORAGE_KEY)
    return emptyOverlay()
  }
}

/** 写失败（配额满 / 存储被禁）只影响「下次打开还在不在」，本次会话内存态照常 */
export function saveOverlay(overlay: ViewerOverlay) {
  writeStore(STORAGE_KEY, JSON.stringify(overlay))
}

export function clearOverlay() {
  removeStore(STORAGE_KEY)
}

export function isEmptyOverlay(overlay: ViewerOverlay): boolean {
  return !overlay.removed.length
    && !Object.keys(overlay.sites).length
    && !Object.keys(overlay.added).length
}

/**
 * 把覆盖层叠加到一份配置上（**不改动传入的底稿**）。
 *
 * 三件事：追加访客新增的站点（放在该分组末尾）→ 滤掉被访客删掉的 → 套用访客改过的字段。
 * 顺序不能反：新增的站点同样要能享受「改」和「删」。
 *
 * ⚠️ 每个站点都要 `{ ...site }` 新建对象，哪怕它没被改过。
 * 只克隆「被改过的那些」是不够的：没被克隆的站点对象会与底稿共用引用，
 * 访客后续的编辑（`Object.assign`）会顺着引用改到底稿上，
 * 站长登录后「摘掉覆盖层」就摘不干净 —— 改动会跟着被上传到云端。
 */
export function applyOverlay(list: Category[], overlay: ViewerOverlay): Category[] {
  const removed = new Set(overlay.removed)
  return list.map(cate => ({
    ...cate,
    groupList: (cate.groupList || []).map((group) => {
      const extra = (overlay.added[groupKey(group)] || []).filter(site => !removed.has(siteKey(site)))
      return {
        ...group,
        siteList: [...(group.siteList || []), ...extra]
          .filter(site => !removed.has(siteKey(site)))
          .map(site => ({ ...site, ...overlay.sites[siteKey(site)] })),
      }
    }),
  }))
}
