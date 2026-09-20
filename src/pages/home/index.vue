<script setup lang="ts">
import MainHeader from './components/MainHeader.vue'
import MainClock from './components/MainClock.vue'
import MainSearch from './components/MainSearch.vue'
import SiteContainer from './components/SiteContainer.vue'
import WallpaperFan from './components/WallpaperFan.vue'
import { toggleSiteSytle } from '@/composables/dark'
import { prefetchOnIdle, useLazyMount } from '@/composables/lazyMount'

/**
 * 首屏只静态导入「访客第一眼就会看到」的东西（头部、时钟、搜索框、导航、小风车）。
 * 下面两个都只有站长在 /setting 或主动点开时才会用到，静态导入会让访客替站长买单 ——
 * 它们连同 MainSetting 依赖的 CloudSync / AdminGate / ResetModal
 * 一起，是首屏 48 个请求里的一大半。
 */
const MainSetting = defineAsyncComponent(() => import('./components/MainSetting.vue'))
const WallpaperPanel = defineAsyncComponent(() => import('./components/WallpaperPanel.vue'))

defineOptions({
  name: 'HomePage',
})

toggleSiteSytle()

const settingStore = useSettingStore()
const adminStore = useAdminStore()
const viewerStore = useViewerStore()
const wallpaperStore = useWallpaperStore()

/** 壁纸面板要挂着才能播抽屉进出动画，所以用「第一次打开才挂载」而不是纯 v-if */
const panelMounted = useLazyMount(() => wallpaperStore.panelVisible)

onMounted(() => {
  // 首屏画完再预取，点开面板时不用等；不预取 MainSetting —— 那是 /setting 页才用的
  prefetchOnIdle(() => import('./components/WallpaperPanel.vue'))
})
</script>

<template>
  <TheDoc dark:op-80>
    <!-- 不再套半透明卡片：壁纸直接铺满整页，容器只负责内边距 -->
    <div p-24 class="mobile-index" :class="{ no_select: settingStore.isSetting }">
      <MainHeader />
      <!-- 口令门模式（访客停在 /setting）下不渲染导航区，只留入口表单 -->
      <template v-if="!adminStore.isGate">
        <MainClock v-if="!settingStore.isSetting" />
        <MainSearch v-if="!settingStore.isSetting" />
        <!-- 访客首次访问：等站长云端配置到位再渲染，避免闪一下内置初始页面 -->
        <SiteContainer v-if="viewerStore.ready" />
        <div v-else flex-center py-40 text-13 op-50>
          正在加载导航…
        </div>
      </template>
      <!-- 只有站长在 /setting（或访客停在 /setting 的口令门）时才需要，首页访客不加载 -->
      <MainSetting v-if="adminStore.isGate || settingStore.isSetting" />
      <!-- 管理员和访客都可使用的本地壁纸面板：第一次点开才挂载 -->
      <WallpaperPanel v-if="panelMounted" />
      <!-- 右下角小风车：点一下随机换一张壁纸 -->
      <WallpaperFan v-if="!settingStore.isSetting && !adminStore.isGate" />
      <TheFooter v-if="!adminStore.isGate" />
    </div>
  </TheDoc>
</template>

<route lang="json">
  {
    "path": "/",
    "children": [
      {
        "name": "setting",
        "path": "setting",
        "component": "@/components/Blank.vue"
      }
    ]
  }
</route>
