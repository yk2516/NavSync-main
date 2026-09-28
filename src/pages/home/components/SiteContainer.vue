<script setup lang="ts">
import SiteNavBar from './SiteNavBar.vue'
import SiteCompact from './SiteCompact.vue'
import SitePager from './SitePager.vue'
import { prefetchOnIdle, useLazyMount } from '@/composables/lazyMount'

/**
 * 三套导航视图，按模式选一：
 *   编辑态（站长在 /setting）→ SiteGroupList：分组全部平铺、标题置顶，可跨分组拖拽
 *   浏览态 · 紧凑列表（默认） → SiteCompact：全部分组纵向铺开，小图标 + 横排名称
 *   浏览态 · 图标网格        → SitePager：一个分组一页，滚轮 / 圆点 / 方向键翻页
 *
 * 浏览态用哪套由 `wallpaperStore.settings.siteLayout` 决定（壁纸面板「站点排版」里切）。
 * 两者都是「访客第一眼就会看到的东西」，所以都静态导入 —— 动态导入会让默认视图
 * 先白一下再出现，省下的几 KB 远不值得。
 *
 * SiteGroupList 连同 vuedraggable 约 37KB，访客一辈子用不到，所以改成按需加载。
 * 它是「非此即彼」的视图，直接用动态导入 + 已有的 v-if 就够了。
 */
const SiteGroupList = defineAsyncComponent(() => import('./SiteGroupList.vue'))
const SiteModal = defineAsyncComponent(() => import('./SiteModal.vue'))

const settingStore = useSettingStore()
const wallpaperStore = useWallpaperStore()
const modalStore = useModalStore()

/** 浏览态当前是否用紧凑列表 */
const isCompact = computed(() => wallpaperStore.settings.siteLayout === 'compact')

/** 弹窗要挂着才能播进出动画，所以「第一次打开才挂载」 */
const modalMounted = useLazyMount(() => modalStore.modalVisible)

onMounted(() => {
  // 首屏画完再预取：右键/点铅笔弹编辑框时不用等
  prefetchOnIdle(() => import('./SiteModal.vue'))
})
</script>

<template>
  <div px="md:60 lg:120" text="$text-c-1 dark:$text-dark-c-1" z-8>
    <SiteNavBar />
    <SiteGroupList v-if="settingStore.isSetting" />
    <SiteCompact v-else-if="isCompact" />
    <SitePager v-else />
    <SiteModal v-if="modalMounted" />
  </div>
</template>
