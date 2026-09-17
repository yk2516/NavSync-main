import { fetchPublicConfig } from '@/utils/cloud'
import { saveViewerCache } from '@/utils/publicConfig'

let bootstrapped = false

/**
 * 访客只读同步：拉取站长已上传到云端的配置并渲染
 *
 * - 首屏渲染不依赖网络：站点/设置 store 初始化时已经读过本地缓存的云端配置
 * - 这里只做后台刷新，拿到最新数据后原地替换，访客无感
 */
export async function syncViewerConfig() {
  const siteStore = useSiteStore()
  const settingStore = useSettingStore()
  const viewerStore = useViewerStore()

  const result = await fetchPublicConfig()
  if (!result.success || !result.data) {
    // 服务端没部署公开接口 / 站长还没上传过配置 → 放行，退回本地缓存或初始页面
    viewerStore.markFailed(result.error || '')
    return
  }

  const { data, settings, updatedAt } = result.data
  if (!Array.isArray(data) || data.length === 0 || !settings) {
    viewerStore.markFailed('云端配置结构异常')
    return
  }

  saveViewerCache({ data, settings, updatedAt })
  siteStore.setData(data)
  settingStore.setSettings(settings)
  toggleTheme(settings.theme)
  toggleSiteSytle()
  useRenderStore().refreshSiteGroupList()
  viewerStore.markReady()
}

/**
 * 应用启动引导
 * 1. 复验站长身份（防止伪造本地标记）
 * 2. 非站长 → 拉取站长云端配置，让访客看到的是站长的导航页而不是内置初始页
 */
export function bootstrapViewer() {
  if (bootstrapped)
    return
  bootstrapped = true

  const adminStore = useAdminStore()

  adminStore.verifyStored().then((isAdmin) => {
    if (isAdmin)
      return
    syncViewerConfig()
  })
}
