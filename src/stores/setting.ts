import { readStore, removeStore, searchList, siteStyleList, themeList, writeStore } from '@/utils'
import preset from '@/preset.json'
import type { SettingItem, Settings } from '@/types'
import { isAdminStored, loadViewerCache } from '@/utils/publicConfig'
import router from '@/router'

export type SettingKey = keyof Settings

export function loadSettings(): Partial<Settings> | undefined {
  // 访客优先用站长云端配置的本地缓存（主题、图标风格等一并跟随站长设置）
  if (!isAdminStored()) {
    const viewerCache = loadViewerCache()
    if (viewerCache?.settings)
      return pickKnownSettings(viewerCache.settings)
  }

  try {
    const settings = readStore('settings')
    if (!settings)
      return undefined
    const parsed = JSON.parse(settings)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('settings 数据格式异常')
    // 只回传「已知 enName」的键，其余交给 preset 兜底（见 pickKnownSettings 说明）
    return pickKnownSettings(parsed)
  }
  catch {
    // 设置数据损坏时清空，回退到默认 preset，避免应用白屏
    removeStore('settings')
    return undefined
  }
}

export const settingData: { [K in SettingKey]: SettingItem<any>[] } = {
  theme: themeList,
  search: searchList,
  siteStyle: siteStyleList,
}

/**
 * 只保留**已知的 enName**，其余键丢弃（回落到预设值）。
 *
 * 为什么必须在数据汇点做：`settings` 有三个外部来源 —— 云端 Gist、
 * 导入的 JSON、以及旧版本遗留在 localStorage 里的值。它们都绕过了类型系统
 * （`Settings` 只声明 `theme: string`，任何字符串都合法）。
 *
 * 脏值的后果不是崩溃而是「静默变丑 + 一处真崩」：
 * - 下拉框找不到匹配项，就把原始英文值直接显示出来（`bing` / `default`）
 * - 主题那一项更狠：`renderThemeLabel` 里 `themeList.find(...)` 返回 undefined，
 *   紧接着取 `.value` 抛 TypeError，Vue 的渲染错误会**整块吞掉主题选择器** ——
 *   页面上直接少一个设置项。真实渲染才会暴露（见硬约定 2）。
 */
function pickKnownSettings(input: Partial<Settings> | undefined): Partial<Settings> {
  if (!input || typeof input !== 'object')
    return {}

  const out: Partial<Settings> = {}
  ;(Object.keys(settingData) as SettingKey[]).forEach((key) => {
    const value = input[key]
    if (typeof value === 'string' && knownValues(key).includes(value))
      out[key] = value
  })
  return out
}

/**
 * 某个设置项的合法取值集合。
 *
 * `search` 要额外算上**自定义搜索引擎**的 enName —— 它们存在 localStorage 的
 * `search_engines_custom` 里、不在内置 `searchList` 中。漏掉的话，选中自定义引擎后
 * 会被当成脏值丢弃、选中项悄悄跳回第一个内置引擎（engine_check 抓到过这条）。
 */
function knownValues(key: SettingKey): string[] {
  const builtin = settingData[key].map(item => item.enName)
  if (key !== 'search')
    return builtin

  try {
    return [...builtin, ...useSearchEngineStore().custom.map(item => item.enName)]
  }
  catch {
    // 极端情况下拿不到引擎 store（如 Pinia 尚未激活）：只认内置的，不影响主流程
    return builtin
  }
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
    // 云端下载 / 导入 JSON 都会走这里：脏 enName 一律丢弃，保留当前有效值
    Object.assign(settings, pickKnownSettings(newSettings))
  }

  watch(settings, () => {
    // 访客只读：不把站长的云端配置写进站长专属的本地配置键
    if (!isAdminStored())
      return
    // 写失败（配额满 / 存储被禁）不该冒泡成未捕获异常，只影响下次打开的恢复
    writeStore('settings', JSON.stringify(toRaw(settings)))
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
