import preset from '@/preset.json'
import type { Category, Group, Site } from '@/types'
import { getFaviconUrl } from '@/utils'
import { isAdminStored, loadViewerCache } from '@/utils/publicConfig'

function loadData(): Category[] | undefined {
  // 访客优先用站长云端配置的本地缓存渲染，避免首屏闪出内置的初始预设页面
  if (!isAdminStored()) {
    const viewerCache = loadViewerCache()
    if (viewerCache?.data?.length)
      return viewerCache.data
  }

  try {
    const data = localStorage.getItem('cache')
    if (!data)
      return undefined
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed))
      throw new Error('cache 数据格式异常')
    return parsed
  }
  catch {
    // 缓存数据损坏时清空，回退到默认 preset，避免应用白屏
    localStorage.removeItem('cache')
    return undefined
  }
}
export const useSiteStore = defineStore('site', () => {
  const data = ref<Category[]>(loadData() || preset.data)
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

  function addSite(site: Site) {
    const url = ensureHttps(site?.url)
    const nextSite: Site = {
      ...site,
      url,
      // 新增网站自动绑定自己的 Favicon；用户填写自定义图标时优先使用自定义值。
      favicon: site.favicon?.trim() || getFaviconUrl(url),
    }
    data.value[cateIndex.value].groupList[groupIndex.value].siteList.push(nextSite)
  }
  function addGroup(group: Group) {
    data.value[cateIndex.value].groupList.push(group)
  }
  function addCate(cate: Category) {
    data.value.push(cate)
  }
  function updateSite(site: Partial<Site>) {
    const current = data.value[cateIndex.value].groupList[groupIndex.value].siteList[siteIndex.value]
    const nextUrl = site.url !== undefined ? ensureHttps(site.url) : current.url
    const patch: Partial<Site> = {
      ...site,
      url: nextUrl,
    }
    // 编辑网址后若没有填写自定义 Favicon，跟随新域名重新获取对应图标。
    const oldAutoFavicon = getFaviconUrl(current.url)
    if (site.url !== undefined && (!site.favicon?.trim() || site.favicon === current.favicon || site.favicon === oldAutoFavicon))
      patch.favicon = getFaviconUrl(nextUrl)
    Object.assign(current, patch)
  }
  function updateGroup(group: Partial<Group>) {
    Object.assign(data.value[cateIndex.value].groupList[groupIndex.value], group)
  }
  function updateCate(cate: Partial<Category>) {
    Object.assign(data.value[cateIndex.value], cate)
  }
  function deleteSite() {
    data.value[cateIndex.value].groupList[groupIndex.value].siteList.splice(siteIndex.value, 1)
  }
  function deleteGroup() {
    data.value[cateIndex.value].groupList.splice(groupIndex.value, 1)
  }
  function deleteCate() {
    data.value.splice(cateIndex.value, 1)
  }
  function cachingData() {
    // 访客只读：不把站长的云端配置写进站长专属的本地配置键
    if (!isAdminStored())
      return
    localStorage.setItem('cache', JSON.stringify(data.value))
  }
  function setData(value: Category[]) {
    data.value = value
    // 确保 cateIndex 不越界
    if (cateIndex.value >= data.value.length)
      cateIndex.value = Math.max(0, data.value.length - 1)
  }

  watch(data, () => {
    cachingData()
  }, { deep: true })

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
