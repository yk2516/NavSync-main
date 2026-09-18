<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components'
import type { Search } from '@/types'
import { getFaviconUrl } from '@/utils'
import searchEngine from '@/utils/search-engine'

const settingStore = useSettingStore()
const engineStore = useSearchEngineStore()

const keyword = ref('')

const currentIndex = ref(0)

const showKeyDownSel = ref(false)

const noticeKeyList = ref<string[]>([])

const selectedIndex = ref(0)

const searchInputRef = ref<HTMLInputElement>()

/**
 * 引擎条默认收起，点搜索框里的引擎图标才展开。
 * 常驻一排图标会把页面压得很重，用户明确要求收起来。
 */
const engineBarVisible = ref(false)

const engines = computed(() => engineStore.engines)

function initCurrentIndex() {
  const idx = engines.value.findIndex(search => search.enName === settingStore.settings.search)
  currentIndex.value = idx >= 0 ? idx : 0
}

watch(() => settingStore.settings.search, () => {
  initCurrentIndex()
}, { immediate: true })

// 自定义引擎增删后索引可能越界，重新定位一次
watch(engines, () => {
  initCurrentIndex()
})

function search() {
  if (!keyword.value.trim())
    return

  const currentSearch = engines.value[currentIndex.value]
  if (!currentSearch)
    return
  window.open(`${currentSearch.url}?${currentSearch.key}=${encodeURIComponent(keyword.value)}`)
  clearNoticeKey()
  searchInputRef.value?.blur()
}

function _getFavicon(search: Search) {
  return search.favicon || getFaviconUrl(search.url)
}

function selectEngine(i: number) {
  currentIndex.value = i
  settingStore.setSettings({ search: engines.value[i].enName })
  engineBarVisible.value = false
}

function toggleEngineBar() {
  const next = !engineBarVisible.value
  engineBarVisible.value = next
  // 引擎条和关键词联想都在搜索框下方，同时出现会打架
  if (next)
    clearNoticeKey()
}

function closeEngineBar() {
  engineBarVisible.value = false
}

const { iconStyle } = useIconStyle()

function handleCloseClick() {
  keyword.value = ''
  searchInputRef.value?.focus()
}

function handleKeyDown(_e: KeyboardEvent) {
  // placeholder for keydown events without specific modifier
}

interface Params {
  eng: string
  list: string[]
  wd: string
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return function (this: any, ...args: Parameters<T>) {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  } as T
}

const requestEngApi = debounce(() => {
  const curSearch = engines.value[currentIndex.value]
  if (!curSearch)
    return
  // 自定义引擎没有联想接口，直接跳过（否则会回落到内置的百度建议，结果对不上）
  if (engineStore.isCustom(curSearch.enName))
    return
  // 记录当前搜索引擎索引，用于竞态检测：回调返回时若已切换引擎则丢弃
  const capturedIndex = currentIndex.value
  searchEngine.complete(curSearch.enName, keyword.value, (params: Params) => {
    if (keyword.value.trim().length === 0)
      return
    // 竞态保护：搜索引擎已切换则丢弃旧回调结果
    if (currentIndex.value !== capturedIndex)
      return

    noticeKeyList.value.splice(0, noticeKeyList.value.length || 0)
    noticeKeyList.value.push(keyword.value, ...params.list)
  })
}, 100)

function handleInput(_e: Event) {
  if (!keyword.value.trim()) {
    clearNoticeKey()
    return
  }
  showKeyDownSel.value = true
  selectedIndex.value = 0
  // 联想列表出现时收起引擎条，两者都在搜索框下方
  engineBarVisible.value = false
  requestEngApi()
}

function jumpSearch(i: number) {
  keyword.value = noticeKeyList.value[i]
  search()
}

function clearNoticeKey() {
  showKeyDownSel.value = false
  noticeKeyList.value.splice(0, noticeKeyList.value.length || 0)
  selectedIndex.value = 0
  noticeKeyList.value.push(keyword.value)
}

function keyNext(e: Event) {
  e.preventDefault()
  // 推荐列表为空时直接返回，避免取模 NaN 导致 keyword 被置为 undefined
  if (!noticeKeyList.value.length)
    return
  selectedIndex.value = (selectedIndex.value + 1) % noticeKeyList.value.length || 0
  keyword.value = noticeKeyList.value[selectedIndex.value]
}

function keyPrev(e: Event) {
  e.preventDefault()
  // 推荐列表为空时直接返回，避免取模 NaN 导致 keyword 被置为 undefined
  if (!noticeKeyList.value.length)
    return
  selectedIndex.value = (selectedIndex.value - 1 + noticeKeyList.value.length) % noticeKeyList.value.length || 0
  keyword.value = noticeKeyList.value[selectedIndex.value]
}

function handleKeyRecomend(e: Event) {
  const clickedInput = e.target === searchInputRef.value
  if (clickedInput)
    return

  clearNoticeKey()
}

function handleHover(i: number) {
  selectedIndex.value = i
}

function handleLeave() {
  selectedIndex.value = 0
}

function handleFocus(_e: Event) {
  handleInput(new Event('input'))
}

function setActive(_i: number) {
  selectedIndex.value = _i
}

function setInactive(_i: number) {
  selectedIndex.value = 0
}

// ---------- 自定义搜索引擎 ----------

const addVisible = ref(false)
const addForm = reactive({ name: '', url: '', key: 'q', favicon: '' })
const addError = ref('')

function openAddEngine() {
  addError.value = ''
  // 收起引擎条，避免它留在弹窗蒙层底下
  engineBarVisible.value = false
  addVisible.value = true
}

function submitAddEngine() {
  if (!addForm.name.trim() || !addForm.url.trim()) {
    addError.value = '名称与搜索地址必填'
    return
  }
  const enName = engineStore.addEngine({ ...addForm })
  if (!enName) {
    addError.value = '添加失败，请检查填写内容'
    return
  }
  addVisible.value = false
  addForm.name = ''
  addForm.url = ''
  addForm.key = 'q'
  addForm.favicon = ''
  const idx = engines.value.findIndex(item => item.enName === enName)
  if (idx >= 0)
    selectEngine(idx)
  window.$message?.success('已添加搜索引擎', { duration: 2000 })
}

function deleteCustomEngine(enName: string) {
  const wasActive = engines.value[currentIndex.value]?.enName === enName
  engineStore.removeEngine(enName)
  if (wasActive) {
    currentIndex.value = 0
    settingStore.setSettings({ search: engines.value[0]?.enName || 'Baidu' })
  }
}
</script>

<template>
  <div class="search-wrap" my-32 flex-center>
    <div class="search-inner">
      <div class="search" style="position: relative;">
        <div v-show="showKeyDownSel" v-on-click-outside="handleKeyRecomend" absolute z-9 class="search-sel" style="top: 100%; width: 100%; height: 10rem;" @mouseleave="handleLeave()">
          <!-- keys recommend -->
          <div z-9 bg-fff l-0 t-100p dark="border-grey-8 bg-18181a">
            <div
              v-for="(item, i) in noticeKeyList.slice(1)" :key="i + 1" text-14 md="text-15" lg="text-15" p-5
              :class="{ 'bg-$site-hover-c': i + 1 === selectedIndex }"
              @mouseover="handleHover(i + 1)"
              @click="jumpSearch(i + 1)"
              @touchstart="setActive(i + 1)"
              @touchend="setInactive(i + 1)"
            >
              <div flex-left gap-x-8 style="margin: 0.75rem; margin-left: 2rem;">
                <div>{{ item }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 当前引擎图标：点它展开下方的引擎列表 -->
        <button
          type="button"
          class="search-sel engine-trigger"
          :class="{ 'engine-trigger--open': engineBarVisible }"
          :title="`当前搜索引擎：${engines[currentIndex]?.name || ''}（点击切换）`"
          @click="toggleEngineBar"
        >
          <img
            decoding="async" loading="lazy" :src="_getFavicon(engines[currentIndex] || engines[0])" :style="iconStyle"
            circle h-26 w-26 class="engine-current"
          >
        </button>

        <div flex items-center class="search-input-holder">
          <input
            ref="searchInputRef" v-model="keyword" h-full w-full bg-inherit op-80 text="15 text-$text-c-1"
            dark="text-$text-dark-c-1"
            placeholder="输入关键词，回车搜索"
            @keydown.enter="search"
            @keydown.exact="handleKeyDown"
            @input.exact="handleInput"
            @focus="handleFocus"
            @keydown.down.exact="keyNext"
            @keydown.up.exact="keyPrev"
            @keydown.ctrl.n.exact="keyNext"
            @keydown.ctrl.p.exact="keyPrev"
          >
        </div>
        <div v-if="keyword?.length > 0" flex-center gap-x-4 w-44>
          <div
            role="button" tabindex="0"
            title="清空" aria-label="清空"
            hover="op-80 rotate-180 scale-110"
            i-carbon:close mx-0 cursor-pointer text-20 op-40 transition duration-300 w-44
            @click="handleCloseClick"
            @keydown.enter.prevent="handleCloseClick"
            @keydown.space.prevent="handleCloseClick"
          />
        </div>
        <div v-if="keyword?.length === 0" flex-center cursor-pointer gap-x-4 w-44 class="search-img" style="background: transparent;" @click="search">
          <span md="text-15" lg="text-15" i-carbon:search inline-block text-14 h-20 w-44 class="search-go" role="button" tabindex="0" title="搜索" aria-label="搜索" @keydown.enter.prevent="search" @keydown.space.prevent="search" />
        </div>
      </div>

      <!-- 搜索引擎横排：默认收起，点搜索框里的引擎图标才展开。
           仿极光Tab，图标并排、可横向滚动、末尾 + 号自定义添加 -->
      <Transition name="engine-bar">
        <div v-show="engineBarVisible" v-on-click-outside="closeEngineBar" class="engine-bar">
          <button
            v-for="(engine, i) in engines"
            :key="engine.enName"
            type="button"
            class="engine-item"
            :class="{ 'engine-item--active': currentIndex === i }"
            :title="engine.name"
            @click="selectEngine(i)"
          >
            <img decoding="async" loading="lazy" :src="_getFavicon(engine)" :style="iconStyle" alt="">
          </button>
          <button type="button" class="engine-item engine-item--add" title="添加搜索引擎" @click="openAddEngine">
            <div i-carbon:add />
          </button>
        </div>
      </Transition>
    </div>

    <!-- 自定义搜索引擎 -->
    <n-modal v-model:show="addVisible" preset="card" title="添加搜索引擎" :style="{ width: 'min(460px, calc(100vw - 32px))' }" :bordered="false">
      <div class="engine-form">
        <label>
          <span>名称</span>
          <n-input v-model:value="addForm.name" placeholder="例如：知乎" />
        </label>
        <label>
          <span>搜索地址</span>
          <n-input v-model:value="addForm.url" placeholder="例如：https://www.zhihu.com/search" />
        </label>
        <label>
          <span>关键词参数</span>
          <n-input v-model:value="addForm.key" placeholder="默认 q，知乎为 type=content&q 时填 q" />
        </label>
        <label>
          <span>图标（选填）</span>
          <n-input v-model:value="addForm.favicon" placeholder="留空自动按域名获取" />
        </label>
        <p class="engine-form__tip">
          在目标站搜索一次，地址栏里 <code>?</code> 后面那个参数名就是要填的「关键词参数」，比如 <code>?wd=xxx</code> 填 <code>wd</code>。
        </p>
        <div v-if="addError" class="engine-form__error">
          {{ addError }}
        </div>

        <div v-if="engineStore.custom.length" class="engine-form__list">
          <div class="engine-form__list-title">
            已添加
          </div>
          <div v-for="item in engineStore.custom" :key="item.enName" class="engine-form__row">
            <img decoding="async" :src="_getFavicon(item)" alt="">
            <span>{{ item.name }}</span>
            <button type="button" @click="deleteCustomEngine(item.enName)">
              删除
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <div flex justify-end gap-x-12>
          <n-button quaternary @click="addVisible = false">
            取消
          </n-button>
          <n-button type="primary" text-color="#fff" @click="submitAddEngine">
            添加
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style lang="scss" scoped>
.search-wrap {
  width: 100%;
}

.search-inner {
  width: min(560px, 100%);
}

.search {
  display: flex;
  align-items: center;
  height: 46px;
  border-radius: 12px;
  background-color: color-mix(in srgb, var(--main-bg-c) calc(var(--wallpaper-input-opacity, .6) * 100%), transparent);
  border: 1px solid color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 16%, transparent);
  backdrop-filter: blur(var(--glass-blur, 10px)) saturate(var(--glass-saturate, 118%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 10px)) saturate(var(--glass-saturate, 118%));
  box-shadow: var(--glass-shadow, none);
  transition: border-color .2s ease, box-shadow .2s ease;
}

.search:focus-within {
  border-color: color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 52%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 16%, transparent);
}

.search-input-holder {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.search-input-holder input {
  border: 0;
  outline: 0;
  height: 100%;
  background: transparent;
}

.engine-current {
  opacity: .9;
  margin: auto;
}

/* 搜索框内的引擎图标：点它展开/收起下方的引擎条 */
.engine-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  flex: 0 0 44px;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color .2s ease;
}

.engine-trigger:hover {
  background-color: color-mix(in srgb, var(--text-c) 12%, transparent);
}

.engine-trigger--open {
  background-color: color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 20%, transparent);
}

.search-go {
  background-color: var(--primary-c);
  opacity: .85;
  margin: auto;
  mask-size: 100% 100%;
}

/* ---------- 引擎横排 ---------- */
.engine-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  margin-top: 10px;
  padding: 6px 10px;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--main-bg-c) calc(var(--wallpaper-input-opacity, .6) * 100%), transparent);
  border: 1px solid color-mix(in srgb, var(--text-c) 10%, transparent);
  backdrop-filter: blur(var(--glass-blur, 10px)) saturate(var(--glass-saturate, 118%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 10px)) saturate(var(--glass-saturate, 118%));
  scrollbar-width: none;
}

.engine-bar::-webkit-scrollbar {
  display: none;
}

/* 展开/收起：引擎条走正常文档流（不覆盖内容），加个短过渡避免生硬跳动 */
.engine-bar-enter-active,
.engine-bar-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}

.engine-bar-enter-from,
.engine-bar-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.engine-item {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-c);
  cursor: pointer;
  opacity: .72;
  transition: opacity .2s ease, transform .2s ease, background-color .2s ease, box-shadow .2s ease;
}

.engine-item img {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: contain;
}

.engine-item:hover {
  opacity: 1;
  transform: translateY(-1px);
  background-color: color-mix(in srgb, var(--text-c) 10%, transparent);
}

.engine-item--active {
  opacity: 1;
  background-color: color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 20%, transparent);
  box-shadow: 0 0 0 1.5px var(--wallpaper-accent, var(--primary-c));
}

.engine-item--add {
  font-size: 16px;
  opacity: .62;
  border: 1px dashed color-mix(in srgb, var(--text-c) 34%, transparent);
}

/* ---------- 自定义引擎弹窗 ---------- */
.engine-form {
  display: grid;
  gap: 12px;
}

.engine-form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.engine-form label > span {
  font-weight: 600;
}

.engine-form__tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: .62;
}

.engine-form__tip code {
  padding: 1px 4px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--text-c) 12%, transparent);
}

.engine-form__error {
  color: #d03050;
  font-size: 12px;
}

.engine-form__list {
  display: grid;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--text-c) 12%, transparent);
}

.engine-form__list-title {
  font-size: 12px;
  font-weight: 600;
  opacity: .62;
}

.engine-form__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.engine-form__row img {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.engine-form__row span {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.engine-form__row button {
  border: 0;
  background: transparent;
  color: #d03050;
  font-size: 12px;
  cursor: pointer;
}

@media screen and (max-width: 640px) {
  .search {
    height: 42px;
  }

  .engine-item {
    width: 28px;
    height: 28px;
  }
}
</style>
