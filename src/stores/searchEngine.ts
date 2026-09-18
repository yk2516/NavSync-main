import type { Search } from '@/types'
import { searchList } from '@/utils'

const STORAGE_KEY = 'search_engines_custom'

function loadCustom(): Search[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      throw new Error('自定义搜索引擎数据格式异常')
    return parsed.filter((item: any) => item && typeof item.enName === 'string' && typeof item.url === 'string')
  }
  catch {
    localStorage.removeItem(STORAGE_KEY)
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom.value))
    }
    catch {
      // 配额异常时忽略：只影响下次打开是否还在
    }
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
