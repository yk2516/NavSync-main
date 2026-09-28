<script setup lang="ts">
import Favicon from './Favicon.vue'
import { safeSiteUrl } from '@/utils'
import type { Site } from '@/types'

/**
 * 浏览态 · 紧凑列表（`settings.siteLayout === 'compact'`，默认）。
 *
 * 与 `SitePager.vue` 的关系：**数据一样，摆法不同**。
 *   SitePager     一个分组一页，5×2 大图标，滚轮 / 圆点翻页
 *   SiteCompact   当前分类的**全部分组纵向铺开**成一页长滚动，小图标 + 横排名称
 *
 * 为什么单独一个组件而不是给 SitePager 加分支：两者的翻页模型是互斥的 ——
 * 分页视图靠 `.pager__track` 的 `translate3d` 切页，长滚动视图根本没有「页」这个概念，
 * 塞进同一个组件只会让两边的状态互相污染（页码、inert、滚轮劫持都要各自判断）。
 *
 * 注意与编辑态的边界：编辑态仍然走 `SiteGroupList.vue`（可跨分组拖拽），这里只管浏览。
 */

const siteStore = useSiteStore()
const modalStore = useModalStore()
const renderStore = useRenderStore()

interface CompactSite extends Site {
  /** 已过协议白名单的可点地址；空串表示链接非法（如 `javascript:`），条目不可点 */
  safeUrl: string
  /** 该站点在所属分组里的下标，右键编辑时用来定位（见 onSiteContextMenu） */
  siteIndex: number
}

interface CompactGroup {
  id: number | string
  /** 该分组在当前分类里的下标 —— 新增 / 编辑站点要用它，**不能用过滤后的数组下标** */
  index: number
  name: string
  sites: CompactSite[]
}

/**
 * 当前分类的全部分组，空分组不占位（与分页视图一致：空分组在浏览态不出现，
 * 否则访客会看到一个只有标题没有内容的空区块）。
 */
const groups = computed<CompactGroup[]>(() => {
  const list = siteStore.currentCateData.groupList || []
  return list
    .map((group, gi) => ({
      id: group.id ?? gi,
      index: gi,
      name: group.name,
      sites: (group.siteList || []).map((site, si) => ({
        ...site,
        safeUrl: safeSiteUrl(site.url),
        siteIndex: si,
      })),
    }))
    .filter(group => group.sites.length > 0)
})

const totalCount = computed(() => groups.value.reduce((sum, group) => sum + group.sites.length, 0))

/** 锚点 id 用**原始分组下标**，这样分组增删后 id 不会整体错位 */
function sectionId(groupIndex: number) {
  return `compact-group-${groupIndex}`
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 当前高亮的分组 = 「最后一个已经滚过顶部阈值的分组」。
 *
 * 用 scroll + rAF 而不是 IntersectionObserver：这里的语义是「当前读到哪一段」，
 * 需要一个全局唯一的答案，而 IO 的回调是「哪个元素进出视口」的离散事件，
 * 还要自己维护进入/离开的集合，反而更绕。
 *
 * ⚠️ 这几个状态必须声明在 `jumpTo` **之前**：`jumpTo` 会读写它们，
 * 写在后面能跑（函数调用发生在初始化之后）但 ESLint 的 no-use-before-define 会报错。
 */
const activeIndex = ref(0)
const ACTIVE_OFFSET = 140
/** 二级导航跳转后的高亮锁定窗口（ms），要盖过平滑滚动的时长 */
const JUMP_LOCK_MS = 900
let jumpLockUntil = 0
let rafId = 0

/**
 * 二级导航：点一下滚到对应分组。
 *
 * 用 `scrollIntoView` 而不是 `window.scrollTo` + 元素 offsetTop：
 * 后者要自己算容器偏移，页面结构一改就错位。分组的 `scroll-margin-top`
 * 在样式里给（见 public.scss 的 `.compact-section`）。
 */
function jumpTo(groupIndex: number) {
  const el = document.getElementById(sectionId(groupIndex))
  const target = groups.value.findIndex(group => group.index === groupIndex)
  if (!el || target < 0)
    return

  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  activeIndex.value = target
  // 跳转后短暂锁住「滚动驱动的高亮」。
  // 目标段落可能因为「下面已经没有内容了」而到不了视口顶部（页面到底了，滚不动），
  // 那时滚动驱动算出来的高亮会落在别的分组上 —— 用户点了 A 却看到 B 亮着。
  // 锁过期后正常同步，用户自己再滚一下高亮立刻回到正确的位置。
  jumpLockUntil = Date.now() + JUMP_LOCK_MS
}

function syncActive() {
  rafId = 0
  if (Date.now() < jumpLockUntil)
    return

  // 滚到底时把最后一段点亮：最后那一段可能永远到不了顶部阈值
  // （页面下方没有足够内容），不特判的话它永远不会成为「当前」。
  const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
  if (atBottom) {
    activeIndex.value = Math.max(0, groups.value.length - 1)
    return
  }

  let next = 0
  groups.value.forEach((group, i) => {
    const el = document.getElementById(sectionId(group.index))
    if (el && el.getBoundingClientRect().top <= ACTIVE_OFFSET)
      next = i
  })
  activeIndex.value = next
}

function onScroll() {
  if (!rafId)
    rafId = requestAnimationFrame(syncActive)
}

// 无条件注册、回调里自己判断（硬约定 29：懒挂载/条件注册的副作用会静默失效）
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  syncActive()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId)
    cancelAnimationFrame(rafId)
})

/** 非法链接不导航，但要给出提示 —— 条目点不动又没有任何反馈，用户只会以为网站挂了 */
function onSiteClick(e: MouseEvent, site: CompactSite) {
  if (!site.safeUrl) {
    e.preventDefault()
    window.$message?.error(`「${site.name}」的链接不是合法的 http/https 地址，请在设置里修改`, { duration: 3200 })
  }
}

/**
 * 右键条目 → 直接打开该站点的编辑弹窗（站长与访客都能用）。
 * 访客的改动只落在自己浏览器的「覆盖层」里，不上传也不下载。
 */
function onSiteContextMenu(e: MouseEvent, groupIndex: number, siteIndex: number) {
  e.preventDefault()
  modalStore.showModal('update', 'site', groupIndex, siteIndex)
}
</script>

<template>
  <section :key="renderStore.siteGroupListKey" class="compact-list" pb-14 text-14 md="text-15" lg="text-15">
    <div v-if="!totalCount" class="compact-list__empty">
      当前分类还没有站点
    </div>

    <template v-else>
      <!-- 二级导航：当前分类的全部分组，点一下滚到对应段落。多于一个分组才出现 -->
      <div v-if="groups.length > 1" class="group-nav">
        <button
          v-for="(group, i) in groups" :key="group.id" type="button" class="group-nav__item"
          :class="{ 'group-nav__item--active': i === activeIndex }"
          :aria-current="i === activeIndex ? 'true' : undefined"
          :title="group.name"
          @click="jumpTo(group.index)"
        >
          {{ group.name }}
        </button>
      </div>

      <section
        v-for="group in groups" :id="sectionId(group.index)" :key="group.id"
        class="compact-section" :aria-label="group.name"
      >
        <div class="compact-section__head">
          <h2 class="compact-section__title">
            {{ group.name }}
          </h2>
          <span class="compact-section__count">{{ group.sites.length }} 个</span>
        </div>

        <div class="compact-grid">
          <a
            v-for="site in group.sites" :key="site.id ?? site.siteIndex"
            class="site-card site-card--compact" :class="{ 'site-card--invalid': !site.safeUrl }"
            :href="site.safeUrl || undefined" target="_blank"
            :title="site.safeUrl ? site.name : `${site.name}（链接无效，请在设置里改成 http/https 地址）`"
            @click="onSiteClick($event, site)"
            @contextmenu="onSiteContextMenu($event, group.index, site.siteIndex)"
          >
            <span class="site-card__box"><Favicon :site="site" /></span>
            <span class="site-card__text">
              <span class="site-card__name">{{ site.name }}</span>
              <span v-if="site.desc" class="site-card__desc">{{ site.desc }}</span>
            </span>
          </a>

          <!-- 分组末尾的「＋」：访客与站长都能加网站（访客的站点只进本地覆盖层） -->
          <button
            type="button" class="site-card site-card--compact site-card--add"
            :title="`添加网站到「${group.name}」`" :aria-label="`添加网站到「${group.name}」`"
            @click="modalStore.showModal('add', 'site', group.index)"
          >
            <span class="site-card__box"><span class="site-card__add-glyph" i-carbon:add /></span>
          </button>
        </div>
      </section>
    </template>
  </section>
</template>

<style lang="scss" scoped>
.compact-list__empty {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  opacity: .5;
}
</style>
