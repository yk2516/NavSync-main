<script setup lang="ts">
import Favicon from './Favicon.vue'
import { safeSiteUrl } from '@/utils'
import type { Site } from '@/types'

const siteStore = useSiteStore()
const wallpaperStore = useWallpaperStore()
const renderStore = useRenderStore()
const modalStore = useModalStore()

const viewportEl = ref<HTMLElement>()

/** 每页容量 = 行 × 列，跟随壁纸面板「自定义布局」实时变化 */
const perPage = computed(() => {
  const rows = Math.max(1, Math.round(wallpaperStore.settings.layoutRows || 1))
  const cols = Math.max(2, Math.round(wallpaperStore.settings.layoutCols || 5))
  return rows * cols
})

interface PageSite extends Site {
  /** 已过协议白名单的可点地址；空串表示链接非法（如 `javascript:`），卡片不可点 */
  safeUrl: string
}

interface Page {
  key: string
  /** 所属分组标识：同一分组被拆成多页时用它归并成一个二级导航项 */
  groupKey: string
  name: string
  sites: PageSite[]
}

/**
 * 一个分组一页。
 * 站点数超过一页容量时自动续页，空分组在浏览态不占页 —— 否则访客会翻到一整页空白。
 */
const pages = computed<Page[]>(() => {
  const groups = siteStore.currentCateData.groupList || []
  const size = perPage.value
  const result: Page[] = []
  groups.forEach((group, gi) => {
    const sites = group.siteList || []
    if (!sites.length)
      return
    const groupKey = String(group.id ?? gi)
    const chunks = Math.ceil(sites.length / size)
    for (let c = 0; c < chunks; c++) {
      result.push({
        key: `${groupKey}-${c}`,
        groupKey,
        name: group.name,
        // 在这里统一过一遍协议白名单，模板里就不用重复调用：
        // 站点数据可能来自导入的 JSON，未过滤的 `javascript:` 会在点击时于本站执行
        sites: sites.slice(c * size, (c + 1) * size)
          .map(site => ({ ...site, safeUrl: safeSiteUrl(site.url) })),
      })
    }
  })
  return result
})

const pageCount = computed(() => pages.value.length)
const pageIndex = ref(0)

/** 当前页所属分组，用于给二级导航打高亮 */
const activeGroupKey = computed(() => pages.value[pageIndex.value]?.groupKey)

/**
 * 二级导航项：当前一级分类下的**全部**分组，横排紧凑展示。
 * 一个分组只出现一次（跨页的分组归并到它的第一页），点一下跳到该分组首页。
 */
const groupNav = computed(() => {
  const seen = new Map<string, { key: string; name: string; pageIndex: number }>()
  pages.value.forEach((page, i) => {
    if (!seen.has(page.groupKey))
      seen.set(page.groupKey, { key: page.groupKey, name: page.name, pageIndex: i })
  })
  return [...seen.values()]
})

// 切分类回到第一页，否则从「常用工具第 3 页」跳到只有 1 页的分类会看到空白
watch(() => siteStore.cateIndex, () => {
  pageIndex.value = 0
})

// 布局容量变化（或分组增删）后页码可能越界，夹回合法范围
watch(pageCount, (count) => {
  if (pageIndex.value > count - 1)
    pageIndex.value = Math.max(0, count - 1)
})

/**
 * 非法链接（`javascript:` / `data:` 等）不导航，但**必须给出提示**。
 * 卡片已经用 `.site-card--invalid` 变灰、鼠标变 not-allowed，
 * 可光靠样式仍可能被当成「网站挂了」，说清楚原因才是完整的处理。
 */
function onSiteClick(e: MouseEvent, site: PageSite) {
  if (!site.safeUrl) {
    e.preventDefault()
    window.$message?.error(`「${site.name}」的链接不是合法的 http/https 地址，请在设置里修改`, { duration: 3200 })
  }
}

function goTo(index: number) {
  const max = Math.max(0, pageCount.value - 1)
  pageIndex.value = Math.min(Math.max(index, 0), max)
}

function prev() {
  goTo(pageIndex.value - 1)
}

function next() {
  goTo(pageIndex.value + 1)
}

/**
 * 滚轮翻页。
 * 普通鼠标滚轮给的是 deltaY，触控板横向滑动给的是 deltaX，两者都认。
 * 用「累加 + 阈值 + 冷却」把一次滚动定格成一页：不加阈值会让一格滚轮翻好几页，
 * 不加冷却则触控板的惯性滚动会把整条导航一路推到底。
 */
const WHEEL_THRESHOLD = 26
const WHEEL_LOCK_MS = 340
let wheelAcc = 0
let wheelLockUntil = 0

function onWheel(e: WheelEvent) {
  if (pageCount.value <= 1)
    return

  const now = Date.now()
  if (now < wheelLockUntil) {
    // 翻页动画期间吞掉残余滚动
    e.preventDefault()
    return
  }

  const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (!raw)
    return

  const dir = raw > 0 ? 1 : -1
  // 已经到边界：不再拦截，把滚动交还给页面，否则用户会被卡在这一屏
  if ((dir > 0 && pageIndex.value >= pageCount.value - 1) || (dir < 0 && pageIndex.value <= 0)) {
    wheelAcc = 0
    return
  }

  wheelAcc += raw
  e.preventDefault()
  if (Math.abs(wheelAcc) < WHEEL_THRESHOLD)
    return

  wheelAcc = 0
  wheelLockUntil = now + WHEEL_LOCK_MS
  if (dir > 0)
    next()
  else
    prev()
}

/** 触屏左右滑动翻页（移动端没有滚轮） */
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch)
    return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function onTouchEnd(e: TouchEvent) {
  if (pageCount.value <= 1)
    return
  const touch = e.changedTouches[0]
  if (!touch)
    return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  // 纵向为主的手势是在滚页面，不抢
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy))
    return
  if (dx < 0)
    next()
  else
    prev()
}

/** 左右方向键翻页；输入框内、弹窗/抽屉打开时不抢按键 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
    return
  if (e.altKey || e.ctrlKey || e.metaKey)
    return
  const el = e.target as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable))
    return
  if (modalStore.modalVisible || wallpaperStore.panelVisible)
    return
  e.preventDefault()
  if (e.key === 'ArrowRight')
    next()
  else
    prev()
}

onMounted(() => {
  // 必须显式 passive: false —— 滚轮监听在很多场景下默认是 passive 的，
  // 那样 preventDefault() 会被忽略，翻页时页面会跟着一起滚
  viewportEl.value?.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  viewportEl.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section :key="renderStore.siteGroupListKey" class="pager" pb-14 text-14 md="text-15" lg="text-15">
    <div v-if="!pageCount" class="pager__empty">
      当前分类还没有站点
    </div>

    <template v-else>
      <div v-if="groupNav.length" class="group-nav">
        <button
          v-for="group in groupNav" :key="group.key" type="button" class="group-nav__item"
          :class="{ 'group-nav__item--active': group.key === activeGroupKey }"
          :aria-current="group.key === activeGroupKey ? 'true' : undefined"
          :title="group.name"
          @click="goTo(group.pageIndex)"
        >
          {{ group.name }}
        </button>
      </div>

      <div
        ref="viewportEl" class="pager__viewport"
        @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd"
      >
        <div class="pager__track" :style="{ transform: `translate3d(-${pageIndex * 100}%, 0, 0)` }">
          <div
            v-for="(page, pi) in pages" :key="page.key" class="pager__page"
            :inert="pi !== pageIndex || undefined"
          >
            <div class="site-grid">
              <a
                v-for="(site, si) in page.sites" :key="site.id ?? si"
                class="site-card" :class="{ 'site-card--invalid': !site.safeUrl }"
                :href="site.safeUrl || undefined" target="_blank"
                :title="site.safeUrl ? site.name : `${site.name}（链接无效，请在设置里改成 http/https 地址）`"
                @click="onSiteClick($event, site)"
              >
                <Favicon :site="site" />
                <span class="site-card__name">{{ site.name }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pageCount > 1" class="pager__dots">
        <button
          v-for="(page, pi) in pages" :key="page.key" type="button" class="pager__dot"
          :class="{ 'pager__dot--active': pi === pageIndex }"
          :aria-current="pi === pageIndex ? 'true' : undefined"
          :title="`第 ${pi + 1} 页：${page.name}`" :aria-label="`第 ${pi + 1} 页：${page.name}`"
          @click="goTo(pi)"
        />
      </div>
    </template>
  </section>
</template>

<style lang="scss" scoped>
.pager__empty {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  opacity: .5;
}

.pager__viewport {
  overflow: hidden;
}

.pager__track {
  display: flex;
  align-items: flex-start;
  transition: transform .42s cubic-bezier(.22, .61, .36, 1);
  will-change: transform;
}

/* 每页等宽，靠 track 的 translate3d 横向位移切换 */
.pager__page {
  flex: 0 0 100%;
  min-width: 0;
}

/* 二级导航：当前一级分类下的全部分组标题，横排紧凑铺开。
 * 翻页（滚轮 / 圆点 / 方向键 / 触屏滑动）时高亮跟着当前页走。 */
.group-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 4px;
  margin-bottom: 18px;
}

.group-nav__item {
  padding: 3px 9px;
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-c);
  background-color: transparent;
  opacity: .58;
  cursor: pointer;
  transition: opacity .2s ease, color .2s ease, background-color .2s ease;
}

.group-nav__item:hover {
  opacity: .9;
  background-color: color-mix(in srgb, var(--main-bg-c) 46%, transparent);
}

.group-nav__item--active {
  font-weight: 600;
  opacity: 1;
  color: var(--wallpaper-accent, var(--primary-c));
  background-color: color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 16%, transparent);
}

.group-nav__item:focus-visible {
  outline: 2px solid var(--wallpaper-accent, var(--primary-c));
  outline-offset: 1px;
}

.pager__dots {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.pager__dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--text-c) 32%, transparent);
  cursor: pointer;
  transition: width .26s ease, background-color .26s ease;
}

.pager__dot:hover {
  background-color: color-mix(in srgb, var(--text-c) 55%, transparent);
}

.pager__dot--active {
  width: 22px;
  border-radius: 4px;
  background-color: var(--wallpaper-accent, var(--primary-c));
}

.pager__dot:focus-visible {
  outline: 2px solid var(--wallpaper-accent, var(--primary-c));
  outline-offset: 2px;
}

/* 尊重系统的「减少动态效果」偏好 */
@media (prefers-reduced-motion: reduce) {
  .pager__track {
    transition: none;
  }

  .pager__dot {
    transition: background-color .26s ease;
  }
}
</style>
