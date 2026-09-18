<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Category } from '@/types'

/**
 * 编辑态的一级分类标签：可拖拽排序 + 「添加分类」按钮。
 *
 * 为什么单独拆成一个组件：vuedraggable 连同 useDrag 打成一个约 100KB 的 chunk。
 * 访客只看不编辑，如果它被 `SiteNavBar.vue` 静态导入，就会骑在首屏关键路径上
 * （ES 静态导入的语义 = 依赖整棵子图下载并执行完，导入方才能开始执行）。
 * 拆开之后由 `SiteNavBar.vue` 用 defineAsyncComponent + v-if 门控，
 * 只有站长进编辑态才会加载。样式在 `src/styles/public.scss` 的 `.cate-nav*` / `.cate-tab*`。
 */
const modalStore = useModalStore()
const siteStore = useSiteStore()
const settingStore = useSettingStore()
const route = useRoute()

/** 在 /setting 里点「当前已选中」的分类 = 打开编辑该分类的弹窗 */
function handleCateClick(cateIndex: number) {
  if (route.name === 'setting' && siteStore.cateIndex === cateIndex)
    modalStore.showModal('update', 'cate')
  else
    siteStore.setCateIndex(cateIndex)
}

const { draggableOptions, handleStart, handleEnd } = useDrag()

function handleDragEnd(e: any) {
  handleEnd()
  const { oldIndex, newIndex } = e
  const { cateIndex } = siteStore
  if (oldIndex === cateIndex && newIndex !== cateIndex) {
    siteStore.setCateIndex(newIndex)
  }
  else {
    if ((oldIndex < cateIndex && newIndex < cateIndex)
          || (oldIndex > cateIndex && newIndex > cateIndex))
      return

    if (oldIndex < cateIndex)
      siteStore.setCateIndex(cateIndex - 1)
    else if (oldIndex > cateIndex)
      siteStore.setCateIndex(cateIndex + 1)
  }
}
</script>

<template>
  <!--
    注意：注释必须放在 draggable 外面，不能放进 #item 插槽里！
    vuedraggable 的 computeNodes 要求插槽每项恰好产出 1 个 vnode，
    dev 模式下 Vue 会把模板注释编译成真实的注释 vnode，插槽就变成
    [注释, div] 两个根节点 → 它抛 "Item slot must have only one child"，
    并把错误栈当成红字 <pre> 顶掉整个列表。生产构建会剥掉注释，所以只有 dev 会炸。
  -->
  <draggable
    class="cate-nav__list"
    :list="siteStore.data"
    item-key="id"
    :component-data="{
      tag: 'div',
      type: 'transition-group',
    }"
    v-bind="draggableOptions"
    @start="handleStart"
    @end="handleDragEnd"
  >
    <template #item="{ element: cate, index: i }: { element: Category, index: number }">
      <div
        class="cate-tab"
        :class="{
          'cate-tab--active': siteStore.cateIndex === i,
          'site--setting': settingStore.isSetting,
          'site--select': siteStore.cateIndex === i && settingStore.isSetting,
        }"
        @click="handleCateClick(i)"
      >
        {{ cate.name }}
      </div>
    </template>
  </draggable>
  <n-button
    class="ml-12"
    type="primary"
    size="small"
    :focusable="false"
    secondary
    title="添加分类"
    aria-label="添加分类"
    @click="modalStore.showModal('add', 'cate')"
  >
    <template #icon>
      <div i-carbon:add />
    </template>
  </n-button>
</template>
