import preset from '@/preset.json'
import type { Category, Group, Site } from '@/types'
import { getFaviconUrl, readStore, removeStore, writeStore } from '@/utils'
import { isAdminStored, loadViewerCache } from '@/utils/publicConfig'
import {
  type ViewerOverlay,
  applyOverlay,
  groupKey,
  loadOverlay,
  saveOverlay,
  siteKey,
} from '@/utils/viewerOverlay'

/** 站长专属的本地配置键（访客永远不写它，见 cachingData） */
function readLocalCache(): Category[] | undefined {
  try {
    const data = readStore('cache')
    if (!data)
      return undefined
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed))
      throw new Error('cache 数据格式异常')
    return parsed
  }
  catch {
    // 缓存数据损坏时清空，回退到默认 preset，避免应用白屏
    removeStore('cache')
    return undefined
  }
}

/**
 * 首屏数据来源。
 *
 * - **站长**：只读自己的本地配置，**不叠加覆盖层** —— 叠加了的话，
 *   点「上传到云端」会把访客的私人改动整份写进 Gist。
 * - **访客**：优先用站长云端配置的本地缓存（避免首屏闪出内置初始预设页），
 *   再叠加本机「覆盖层」（访客自己的改 / 删 / 新增）。
 *
 * 一并返回 `base`（叠加前的底稿）：身份从访客切回站长时靠它把覆盖层摘掉。
 */
function loadInitial(): { data: Category[]; base: Category[] | null } {
  if (isAdminStored())
    return { data: readLocalCache() || preset.data, base: null }

  const cached = loadViewerCache()
  const base = (cached && cached.data.length) ? cached.data : readLocalCache()
  if (!base)
    return { data: preset.data, base: null }

  return { data: applyOverlay(base, loadOverlay()), base }
}

export const useSiteStore = defineStore('site', () => {
  const adminStore = useAdminStore()

  const initial = loadInitial()
  const data = ref<Category[]>(initial.data)

  /** 访客覆盖层所基于的原始配置（云端配置底稿）；站长身份下恒为 null */
  let viewerBase: Category[] | null = initial.base
  /** 访客的本地改动：只存自己浏览器，不上传也不下载 */
  const overlay: ViewerOverlay = loadOverlay()
  /** 「摘除覆盖层」那一次数据替换不该落盘，见下方 watchIdentity */
  let stripTarget: Category[] | null = null

  const cateIndex = ref(0)
  const groupIndex = ref(0)
  const siteIndex = ref(0)

  const setCateIndex = (i: number) => cateIndex.value = i
  const setGroupIndex = (i: number) => groupIndex.value = i
  const setSiteIndex = (i: number) => siteIndex.value = i

  const cateList = computed(() => data.value.map(cate => ({ id: cate.id, name: cate.name })))
  const currentCateData = computed(() => data.value[cateIndex.value] || { groupList: [] })

  /**
   * 写入前规范化（仅用于「用户手工新增 / 编辑站点」这条路径）。
   *
   * ⚠️ 它**不覆盖**数据加载路径 —— `setData()` 是直接赋值，导入 JSON、
   * 云端下载、访客拉 public-config 都不经过这里。所以它不能当作安全防线：
   * `javascript:` 这类非法协议在这里会被前缀成 `https://javascript:...`
   * （坏链接但无害），而导入的数据则会原样进入 store。
   * 真正拦住脚本执行的是渲染层的 `safeSiteUrl()`（见 `utils/commons.ts`）。
   */
  function ensureHttps(url: string | undefined) {
    if (url === undefined || url === null)
      return ''

    if (!url.match(/^(http:\/\/|https:\/\/).*/))
      url = `https://${url}`

    return url
  }

  // ---------- 访客覆盖层：记录访客的改动 ----------
  //
  // 为什么不靠 `data` 的深监听统一落盘：覆盖层要的是「用户改了什么」，
  // 深监听只看得到「结果变了」，两者不是一回事；而且访客路径不该把整份 `data`
  // 序列化进站长的配置键（见 cachingData）。所以三个改动入口各自即时落盘。

  /** 改站点：只记被改过的字段 */
  function recordSitePatch(key: string, patch: Partial<Site>) {
    if (isAdminStored())
      return
    overlay.sites[key] = { ...overlay.sites[key], ...patch }
    saveOverlay(overlay)
  }

  /** 删站点：访客自己新增的直接从覆盖层摘掉，云端来的记一笔「删除」 */
  function recordSiteRemoved(key: string, group: Group) {
    if (isAdminStored())
      return

    delete overlay.sites[key]

    const gkey = groupKey(group)
    const addedList = overlay.added[gkey]
    if (addedList?.some(site => siteKey(site) === key)) {
      const rest = addedList.filter(site => siteKey(site) !== key)
      if (rest.length)
        overlay.added[gkey] = rest
      else
        delete overlay.added[gkey]
      saveOverlay(overlay)
      return
    }

    if (!overlay.removed.includes(key))
      overlay.removed.push(key)
    saveOverlay(overlay)
  }

  /** 新增站点：追加到该分组的覆盖层列表（渲染顺序 = 云端站点在前、访客新增在后） */
  function recordSiteAdded(group: Group, site: Site) {
    const gkey = groupKey(group)
    overlay.added[gkey] = [...(overlay.added[gkey] || []), site]
    saveOverlay(overlay)
  }

  function addSite(site: Site) {
    const url = ensureHttps(site?.url)
    const nextSite: Site = {
      ...site,
      url,
      // 新增网站自动绑定自己的 Favicon；用户填写自定义图标时优先使用自定义值。
      favicon: site.favicon?.trim() || getFaviconUrl(url),
    }

    const group = data.value[cateIndex.value].groupList[groupIndex.value]
    // 访客：站点只进本地覆盖层，不上传也不写站长的配置键；
    // 本次会话靠下面的 push 立刻可见，下次打开由 applyOverlay 从覆盖层补回来
    if (!isAdminStored())
      recordSiteAdded(group, nextSite)

    group.siteList.push(nextSite)
  }
  function addGroup(group: Group) {
    data.value[cateIndex.value].groupList.push(group)
  }
  function addCate(cate: Category) {
    data.value.push(cate)
  }
  function updateSite(site: Partial<Site>) {
    const current = data.value[cateIndex.value].groupList[groupIndex.value].siteList[siteIndex.value]
    if (!current)
      return

    const nextUrl = site.url !== undefined ? ensureHttps(site.url) : current.url
    const patch: Partial<Site> = {
      ...site,
      url: nextUrl,
    }
    // 编辑网址后若没有填写自定义 Favicon，跟随新域名重新获取对应图标。
    const oldAutoFavicon = getFaviconUrl(current.url)
    if (site.url !== undefined && (!site.favicon?.trim() || site.favicon === current.favicon || site.favicon === oldAutoFavicon))
      patch.favicon = getFaviconUrl(nextUrl)

    // 覆盖层的键必须在**改动前**取：站点没有 id 时键是「名称+链接」兜底，改完就取不到了
    const key = siteKey(current)
    Object.assign(current, patch)
    recordSitePatch(key, patch)
  }
  function updateGroup(group: Partial<Group>) {
    Object.assign(data.value[cateIndex.value].groupList[groupIndex.value], group)
  }
  function updateCate(cate: Partial<Category>) {
    Object.assign(data.value[cateIndex.value], cate)
  }
  function deleteSite() {
    const group = data.value[cateIndex.value].groupList[groupIndex.value]
    const list = group?.siteList
    const current = list?.[siteIndex.value]
    if (!current)
      return

    recordSiteRemoved(siteKey(current), group)
    list.splice(siteIndex.value, 1)
  }
  function deleteGroup() {
    data.value[cateIndex.value].groupList.splice(groupIndex.value, 1)
  }
  function deleteCate() {
    data.value.splice(cateIndex.value, 1)
  }
  function cachingData() {
    // 「摘除覆盖层」那一次替换不落盘：那次 data 只是从「底稿+覆盖层」换回底稿本身，
    // 不该顺手把站长的本地配置覆盖成云端那份。
    // 用「是不是同一个数组」判断而不是布尔开关 —— 开关一旦没被复位就会永久停写。
    if (stripTarget && data.value === stripTarget) {
      stripTarget = null
      return
    }
    // 访客的改动走覆盖层单独落盘（见 recordSitePatch），
    // 绝不能把访客看到的数据整体写进站长的配置键
    if (!isAdminStored())
      return
    // 写失败（配额满 / 存储被禁）只影响下次打开能否恢复，不该让本次编辑失败
    writeStore('cache', JSON.stringify(data.value))
  }
  function setData(value: Category[]) {
    if (isAdminStored()) {
      // 站长路径（云端下载 / 导入 JSON）：原样替换，覆盖层不参与
      viewerBase = null
      data.value = value
    }
    else {
      // 访客路径（拉站长云端配置）：以这份配置为新底稿，重新叠加本地覆盖层
      viewerBase = value
      data.value = applyOverlay(value, overlay)
    }

    // 确保 cateIndex 不越界
    if (cateIndex.value >= data.value.length)
      cateIndex.value = Math.max(0, data.value.length - 1)
  }

  watch(data, () => {
    cachingData()
  }, { deep: true })

  /**
   * 身份从「访客」切成「站长」（口令门通过）时，把覆盖层从内存里摘掉。
   *
   * 口令门是**不刷新页面**的：不摘的话，站长接着点「上传到云端」会把
   * `siteStore.data`（= 云端配置 + 访客的改 / 删 / 新增）整份写进 Gist ——
   * 访客的私人改动就这样变成了站长的线上配置。
   *
   * 摘法就是换回底稿本身：站长仍然看到刚才那份云端配置，只是不含访客改动。
   */
  watch(() => adminStore.isAdmin, (isAdmin) => {
    if (!isAdmin || !viewerBase)
      return

    const base = viewerBase
    viewerBase = null
    stripTarget = base
    data.value = base
  })

  return {
    data,
    cateIndex,
    cateList,
    currentCateData,
    setCateIndex,
    setGroupIndex,
    setSiteIndex,
    addSite,
    addGroup,
    addCate,
    updateSite,
    updateGroup,
    updateCate,
    deleteSite,
    deleteGroup,
    deleteCate,
    setData,
  }
})
