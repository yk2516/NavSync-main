<script setup lang="ts">
// 显式导入，不靠自动导入：本文件其余符号都走 auto-import，但懒加载辅助函数
// 在 dev 服务器的自动导入缓存里可能不存在（缓存早于该模块创建），
// 会变成运行时的 "prefetchOnIdle is not defined"。
import { prefetchOnIdle } from '@/composables/lazyMount'

const modalStore = useModalStore()
const siteStore = useSiteStore()
const settingStore = useSettingStore()
const adminStore = useAdminStore()
const route = useRoute()

/**
 * 一级分类标签（下划线样式，仿 inftab）。
 *
 * 编辑态要用 vuedraggable 拖拽排序，但那个库连同 useDrag 打成一个约 100KB 的 chunk。
 * 访客只看不编辑，把它静态导入会让**整棵依赖子图**都必须先下载并执行完，
 * 首页才能开始执行 —— 也就是访客替站长买单。所以这里按 isSetting 二选一：
 * 编辑态异步加载 `SiteNavBarEdit.vue`，浏览态走下面的纯列表（零额外依赖）。
 *
 * 样式在 `src/styles/public.scss` 的 `.cate-nav*` / `.cate-tab*`，两套视图共用。
 */
const SiteNavBarEdit = defineAsyncComponent(() => import('./SiteNavBarEdit.vue'))

onMounted(() => {
  // 只有站长会在编辑态用到它。给站长预取，避免点齿轮进编辑态时标签栏空一下；
  // 访客不预取 —— 那 100KB 对他们是纯浪费。
  if (adminStore.isAdmin)
    prefetchOnIdle(() => import('./SiteNavBarEdit.vue'))
})

/** 在 /setting 里点「当前已选中」的分类 = 打开编辑该分类的弹窗 */
function handleCateClick(cateIndex: number) {
  if (route.name === 'setting' && siteStore.cateIndex === cateIndex)
    modalStore.showModal('update', 'cate')
  else
    siteStore.setCateIndex(cateIndex)
}
</script>

<template>
  <section class="cate-nav" flex-center>
    <!-- 站长在 /setting（编辑态）：可拖拽排序 + 添加分类，按需加载 -->
    <SiteNavBarEdit v-if="settingStore.isSetting" />
    <!-- 访客（浏览态）：纯列表，不引入拖拽库 -->
    <div v-else class="cate-nav__list">
      <div
        v-for="(cate, i) in siteStore.data"
        :key="cate.id"
        class="cate-tab"
        :class="{ 'cate-tab--active': siteStore.cateIndex === i }"
        @click="handleCateClick(i)"
      >
        {{ cate.name }}
      </div>
    </div>
  </section>
</template>
