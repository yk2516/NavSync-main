<script setup lang="ts">
import Favicon from './Favicon.vue'
import { safeSiteUrl } from '@/utils'
import type { Site } from '@/types'

/**
 * 浏览态 · 紧凑列表（`settings.siteLayout === 'compact'`，默认）。
 *
 * 一页从上到下把**所有分类**依次铺开（2026-09-28 用户要求「整页都是长图、不要左右导航」）：
 *
 * ```
 * 常用                       ← 分类标题（.cate-section）
 *   ┌ 默认  12 个 ─────────┐  ← 分组卡片（.compact-panel），分组名在卡片左上角
 *   │ [站][站][站]…        │
 *   └──────────────────────┘
 *   ┌ 好用  6 个 ──────────┐
 * AI工具                     ← 下一个分类接着往下排
 * ```
 *
 * 顶部那排横向分类标签（`SiteNavBar`）在紧凑态**不渲染**（见 SiteContainer）——
 * 「点标签切分类」正是被去掉的「左右导航」；分类改由页面上的大标题区分。
 *
 * 与 `SitePager.vue` 的关系：**数据一样，摆法不同**。
 *   SitePager     一个分组一页，5×2 大图标，滚轮 / 圆点翻页（分类仍靠顶部标签切）
 *   SiteCompact   所有分类纵向铺开成一页长滚动，小图标 + 横排名称
 *
 * 为什么单独一个组件而不是给 SitePager 加分支：两者的翻页模型是互斥的 ——
 * 分页视图靠 `.pager__track` 的 `translate3d` 切页，长滚动视图根本没有「页」这个概念，
 * 塞进同一个组件只会让两边的状态互相污染（页码、inert、滚轮劫持都要各自判断）。
 *
 * ⚠️ **跨分类编辑/新增必须先 `setCateIndex`**：`modalStore.showModal()` 内部是按
 * `siteStore.cateIndex` 去取数据的（见 stores/modal.ts），不先切过去，
 * 动到的会是「当前分类里同下标」的那个站点 —— 而且当场看不出来，提交后才写错。
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
  /** 该分组在所属分类里的下标 —— 新增 / 编辑站点要用它，**不能用过滤后的数组下标** */
  index: number
  name: string
  sites: CompactSite[]
}

interface CompactCate {
  id: number | string
  /** 该分类在 `siteStore.data` 里的下标 —— 跨分类编辑时先 `setCateIndex` 用它 */
  index: number
  name: string
  groups: CompactGroup[]
  total: number
}

/**
 * 全部分类 → 各自的分组 → 各自的站点。
 *
 * 空分组不占位（与分页视图一致：空分组在浏览态不出现，否则访客会看到一个只有标题
 * 没有内容的空区块）；**整组都空的分类也不出现**，否则长滚动里会插进一个孤零零的标题。
 */
const cates = computed<CompactCate[]>(() => {
  const list = siteStore.data || []
  return list
    .map((cate, ci) => {
      const groups = (cate.groupList || [])
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

      return {
        id: cate.id ?? ci,
        index: ci,
        name: cate.name,
        groups,
        total: groups.reduce((sum, group) => sum + group.sites.length, 0),
      }
    })
    .filter(cate => cate.groups.length > 0)
})

const totalCount = computed(() => cates.value.reduce((sum, cate) => sum + cate.total, 0))

/** 锚点 id 用**原始下标**，这样分类/分组增删后 id 不会整体错位 */
function cateId(cateIndex: number) {
  return `compact-cate-${cateIndex}`
}

function sectionId(cateIndex: number, groupIndex: number) {
  return `compact-group-${cateIndex}-${groupIndex}`
}

/** 非法链接不导航，但要给出提示 —— 条目点不动又没有任何反馈，用户只会以为网站挂了 */
function onSiteClick(e: MouseEvent, site: CompactSite) {
  if (!site.safeUrl) {
    e.preventDefault()
    window.$message?.error(`「${site.name}」的链接不是合法的 http/https 地址，请在设置里修改`, { duration: 3200 })
  }
}

/** 点「＋」→ 往**这个分类的这个分组**里加站点（先切 cateIndex，见文件头注释） */
function onAddSite(cateIndex: number, groupIndex: number) {
  siteStore.setCateIndex(cateIndex)
  modalStore.showModal('add', 'site', groupIndex)
}

/**
 * 右键条目 → 直接打开该站点的编辑弹窗（站长与访客都能用）。
 * 访客的改动只落在自己浏览器的「覆盖层」里，不上传也不下载。
 */
function onSiteContextMenu(e: MouseEvent, cateIndex: number, groupIndex: number, siteIndex: number) {
  e.preventDefault()
  siteStore.setCateIndex(cateIndex)
  modalStore.showModal('update', 'site', groupIndex, siteIndex)
}
</script>

<template>
  <section :key="renderStore.siteGroupListKey" class="compact-list" pb-14 text-14 md="text-15" lg="text-15">
    <div v-if="!totalCount" class="compact-list__empty">
      还没有站点
    </div>

    <template v-else>
      <section
        v-for="cate in cates" :id="cateId(cate.index)" :key="cate.id"
        class="cate-section" :aria-label="cate.name"
      >
        <div class="cate-section__head">
          <h2 class="cate-section__title">
            {{ cate.name }}
          </h2>
          <span class="cate-section__count">{{ cate.total }} 个</span>
        </div>

        <section
          v-for="group in cate.groups" :id="sectionId(cate.index, group.index)" :key="group.id"
          class="compact-section" :aria-label="group.name"
        >
          <div class="compact-panel">
            <div class="compact-section__head">
              <h3 class="compact-section__title">
                {{ group.name }}
              </h3>
              <span class="compact-section__count">{{ group.sites.length }} 个</span>
            </div>

            <div class="compact-grid">
              <a
                v-for="site in group.sites" :key="site.id ?? site.siteIndex"
                class="site-card site-card--compact" :class="{ 'site-card--invalid': !site.safeUrl }"
                :href="site.safeUrl || undefined" target="_blank"
                :title="site.safeUrl ? site.name : `${site.name}（链接无效，请在设置里改成 http/https 地址）`"
                @click="onSiteClick($event, site)"
                @contextmenu="onSiteContextMenu($event, cate.index, group.index, site.siteIndex)"
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
                @click="onAddSite(cate.index, group.index)"
              >
                <span class="site-card__box"><span class="site-card__add-glyph" i-carbon:add /></span>
              </button>
            </div>
          </div>
        </section>
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
