<script setup lang="ts">
import SiteNavBar from './SiteNavBar.vue'
import SiteGroupList from './SiteGroupList.vue'
import SitePager from './SitePager.vue'
import SiteModal from './SiteModal.vue'

/**
 * 两套导航视图，按模式二选一：
 *   编辑态（站长在 /setting）→ SiteGroupList：分组全部平铺、标题置顶，可跨分组拖拽
 *   浏览态（首页 / 访客）    → SitePager：一个分组一页，滚轮 / 圆点 / 方向键翻页
 */
const settingStore = useSettingStore()
</script>

<template>
  <div px="md:60 lg:120" text="$text-c-1 dark:$text-dark-c-1" z-8>
    <SiteNavBar />
    <SiteGroupList v-if="settingStore.isSetting" />
    <SitePager v-else />
    <SiteModal />
  </div>
</template>
