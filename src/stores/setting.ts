import { iconStyleList, searchList, siteStyleList, themeList } from '@/utils'
import preset from '@/preset.json'
import type { SettingItem, Settings } from '@/types'
import { isAdminStored, loadViewerCache } from '@/utils/publicConfig'
import router from '@/router'

export type SettingKey = keyof Settings

export function loadSettings(): Settings | undefined {
  // 访客优先用站长云端配置的本地缓存（主题、图标风格等一并跟随站长设置）
  if (!isAdminStored()) {
    const viewerCache = loadViewerCache()
    if (viewerCache?.settings)
      return viewerCache.settings
  }

  try {
    const settings = localStorage.getItem('settings')
    if (!settings)
      return undefined
    const parsed = JSON.parse(settings)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('settings 数据格式异常')
    return parsed
  }
  catch {
    // 设置数据损坏时清空，回退到默认 preset，避免应用白屏
    localStorage.removeItem('settings')
    return undefined
  }
}

export const settingData: { [K in SettingKey]: SettingItem<any>[] } = {
  theme: themeList,
  search: searchList,
  iconStyle: iconStyleList,
  siteStyle: siteStyleList,
}

export const useSettingStore = defineStore('theme', () => {
  const adminStore = useAdminStore()

  // 只有站长进入 /setting 才算「设置模式」。
  // 访客即使手敲 /setting 也只会看到口令门，永远处于只读浏览态
  // （拖拽排序、增删站点、编辑弹窗全部由该标记控制，因此一并被关掉）
  //
  // 用 router 实例而非 useRoute()：本 store 可能在组件上下文之外首次创建，
  // 那种情况下 inject() 取不到路由对象
  const isSetting = computed(() => router.currentRoute.value.name === 'setting' && adminStore.isAdmin)

  const settingCache = loadSettings()
  const presetSetting = preset.settings
  const settings = reactive<Settings>((() => {
    // 始终返回全新对象，避免直接引用 preset.settings 导致后续修改污染模块级常量
    if (settingCache)
      return { ...presetSetting, ...settingCache }
    return { ...presetSetting }
  })())

  function getSettingItem(key: SettingKey) {
    return settingData[key].find(item => item.enName === settings[key]) ?? settingData[key][0]
  }

  function setSettings(newSettings: Partial<Settings>) {
    Object.assign(settings, newSettings)
  }

  watch(settings, () => {
    // 访客只读：不把站长的云端配置写进站长专属的本地配置键
    if (!isAdminStored())
      return
    localStorage.setItem('settings', JSON.stringify(toRaw(settings)))
  }, { deep: true })

  const isDragging = ref(false)
  function setIsDragging(status: boolean) {
    isDragging.value = status
  }

  const isWhiteTheme = computed(() => settings.theme === 'MoonWhite')

  return {
    isWhiteTheme,
    isSetting,
    settings,
    isDragging,
    setSettings,
    setIsDragging,
    getSettingItem,
  }
})
