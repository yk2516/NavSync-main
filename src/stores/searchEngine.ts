import type { Search } from '@/types'
import { readStore, removeStore, safeSiteUrl, searchList, writeStore } from '@/utils'

const STORAGE_KEY = 'search_engines_custom'

function loadCustom(): Search[] {
  const raw = readStore(STORAGE_KEY)
  if (!raw)
    return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      throw new Error('自定义搜索引擎数据格式异常')
    // url 同样要过协议白名单：新增/编辑走 normalize() 会补 https，
    // 但**从 localStorage 读回的数据不经过它** —— 手工写进去的 `javascript:`
    // 会一路进到 `window.open`（浏览器会拦，但没必要留一颗哑弹）。
    return parsed.filter((item: any) =>
      item
      && typeof item.enName === 'string'
      && typeof item.url === 'string'
      && !!safeSiteUrl(item.url),
    )
  }
  catch {
    removeStore(STORAGE_KEY)
    return []
  }
}

/**
 * 搜索引擎列表 = 内置（百度/必应/谷歌/搜狗/维基）+ 用户自定义。
 * 自定义项持久化在 localStorage，与站长/访客身份无关（属于本机使用偏好）。
 */
export const useSearchEngineStore = defineStore('searchEngine', () => {
  const custom = ref<Search[]>(loadCustom())

  const builtin = computed<Search[]>(() => searchList.map(item => item.value))
  const engines = computed<Search[]>(() => [...builtin.value, ...custom.value])

  function persist() {
    // 配额异常 / 存储被禁时忽略：只影响下次打开是否还在
    writeStore(STORAGE_KEY, JSON.stringify(custom.value))
  }

  function normalize(input: { name: string; url: string; key: string; favicon?: string }) {
    const name = input.name.trim()
    let url = input.url.trim()
    if (!name || !url)
      return undefined
    if (!/^https?:\/\//i.test(url))
      url = `https://${url}`
    return { name, url, key: (input.key || 'q').trim(), favicon: input.favicon?.trim() || '' }
  }

  function addEngine(input: { name: string; url: string; key: string; favicon?: string }) {
    const fields = normalize(input)
    if (!fields)
      return false

    const engine: Search = { ...fields, enName: `custom-${Date.now()}` }
    custom.value.push(engine)
    persist()
    return engine.enName
  }

  /**
   * 编辑已添加的引擎。
   * 保留原 enName（它是「当前选中的引擎」在 settings.search 里的标识），
   * 否则改完名字选中项会丢、搜索框图标会跳回第一个。
   */
  function updateEngine(enName: string, input: { name: string; url: string; key: string; favicon?: string }) {
    const index = custom.value.findIndex(item => item.enName === enName)
    if (index === -1)
      return false
    const fields = normalize(input)
    if (!fields)
      return false

    // 整体替换而不是就地改属性：确保数组级依赖（engines 计算属性）一定被触发
    custom.value.splice(index, 1, { ...custom.value[index], ...fields })
    persist()
    return true
  }

  function removeEngine(enName: string) {
    const index = custom.value.findIndex(item => item.enName === enName)
    if (index === -1)
      return false
    custom.value.splice(index, 1)
    persist()
    return true
  }

  function isCustom(enName: string) {
    return enName.startsWith('custom-')
  }

  function findEngine(enName: string) {
    return engines.value.find(item => item.enName === enName)
  }

  return {
    custom,
    builtin,
    engines,
    addEngine,
    updateEngine,
    removeEngine,
    isCustom,
    findEngine,
  }
})
