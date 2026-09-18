<script setup lang="ts">
import { RouterLink } from 'vue-router'

const route = useRoute()
const adminStore = useAdminStore()
const wallpaperStore = useWallpaperStore()

function toggleSetting() {
  return route.path === '/setting'
}

function getIconClass(routeName: string) {
  return {
    'text-$primary-c opacity-100': routeName === route.name,
  }
}
</script>

<template>
  <div class="main-header" flex items-center justify-between py-24 px="12 md:24 lg:48">
    <!-- 左上角站点 logo（循环箭头），移动端隐藏。
         链接里只有一张图，若不给可访问名称，读屏会读成「链接」而不说明去哪 -->
    <RouterLink to="/" class="header-desktop-only" title="返回首页" aria-label="返回首页">
      <div text="$primary-c" flex-center text-16 style="font-weight: bold;">
        <img decoding="async" loading="lazy" src="/favicon.png" alt="NavSync" inline-block text-32 transition duration-300 w-32 hover="opacity-70">
      </div>
    </RouterLink>
    <!-- ml-auto：移动端 logo 隐藏后，右侧按钮组仍靠右 -->
    <div ml-auto flex items-center gap-x-8>
      <!-- 设置入口只对站长显示：访客看不到齿轮，也没有可点的入口 -->
      <RouterLink
        v-if="adminStore.isAdmin"
        class="header-icon-button"
        :class="getIconClass('setting')"
        :to="toggleSetting() ? '/' : '/setting'"
        title="设置"
        aria-label="设置"
        i-carbon:settings
        icon-btn
      />
      <!-- 壁纸属于本地外观设置，管理员和访客都可以打开。
           图标用自定义 svg/wallpaper.svg，尺寸与左上 logo 对齐（图标 scale 1.2，故 27*1.2≈32px） -->
      <button
        type="button"
        title="壁纸与外观"
        aria-label="壁纸与外观"
        class="header-icon-button header-desktop-only"
        i-cus:wallpaper
        text-27
        icon-btn
        @click="wallpaperStore.openPanel"
      />
    </div>
  </div>
</template>
