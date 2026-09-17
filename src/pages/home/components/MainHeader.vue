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
  <div flex justify-between py-24 px="12 md:24 lg:48">
    <RouterLink to="/">
      <div text="$primary-c" flex-center text-16 style="font-weight: bold;">
        <img decoding="async" loading="lazy" src="/favicon.png" inline-block text-32 transition duration-300 w-32 hover="opacity-70">
      </div>
    </RouterLink>
    <div flex gap-x-8>
      <!-- 壁纸属于本地外观设置，管理员和访客都可以打开 -->
      <button
        type="button"
        title="壁纸与外观"
        class="header-icon-button"
        i-carbon:image
        icon-btn
        @click="wallpaperStore.openPanel"
      />
      <!-- 设置入口只对站长显示：访客看不到齿轮，也没有可点的入口 -->
      <RouterLink
        v-if="adminStore.isAdmin"
        :class="getIconClass('setting')"
        :to="toggleSetting() ? '/' : '/setting'"
        i-carbon:settings
        icon-btn
      />
    </div>
  </div>
</template>
