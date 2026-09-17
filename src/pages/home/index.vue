<script setup lang="ts">
import MainHeader from './components/MainHeader.vue'
import MainClock from './components/MainClock.vue'
import MainSearch from './components/MainSearch.vue'
import SiteContainer from './components/SiteContainer.vue'
import MainSetting from './components/MainSetting.vue'
import WallpaperPanel from './components/WallpaperPanel.vue'
import { toggleSiteSytle } from '@/composables/dark'

defineOptions({
  name: 'HomePage',
})

toggleSiteSytle()

const settingStore = useSettingStore()
const adminStore = useAdminStore()
const viewerStore = useViewerStore()
</script>

<template>
  <TheDoc dark:op-80>
    <div my-6vh p-24 bg="$main-bg-c" dark="bg-$dark-main-bg-c" class="mobile-index" :class="{ no_select: settingStore.isSetting }">
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
      <MainSetting />
      <!-- 管理员和访客都可使用的本地壁纸面板 -->
      <WallpaperPanel />
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
