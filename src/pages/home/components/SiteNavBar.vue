<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Category } from '@/types'

const modalStore = useModalStore()
const siteStore = useSiteStore()
const route = useRoute()

function handleCateClick(cateIndex: number) {
  if (route.name === 'setting' && siteStore.cateIndex === cateIndex)
    modalStore.showModal('update', 'cate')
  else
    siteStore.setCateIndex(cateIndex)
}

const settingStore = useSettingStore()

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
  <section class="cate-nav" flex-center>
    <!--
      一级分类：下划线标签（仿 inftab）。

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
      v-if="settingStore.isSetting"
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
  </section>
</template>

<style lang="scss" scoped>
.cate-nav {
  padding-bottom: 12px;
}

.cate-nav__list {
  display: flex;
  gap: 6px;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: none;
  padding: 4px 2px;
}

.cate-nav__list::-webkit-scrollbar {
  display: none;
}

/* 一级分类：下划线标签（仿 inftab）。
 * 原先的实心胶囊底色很重，和下面的图标网格抢视觉；改成纯文字 + 强调色下划线后
 * 整块导航清爽很多，选中态靠「下划线 + 加深加粗」表达，在壁纸上依然分得清。 */
.cate-tab {
  position: relative;
  flex: 0 0 auto;
  padding: 7px 14px 10px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  color: var(--text-c);
  opacity: .68;
  background-color: transparent;
  transition: opacity .2s ease, color .2s ease, background-color .2s ease;
}

.cate-tab::after {
  content: '';
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 2px;
  border-radius: 2px;
  background-color: var(--wallpaper-accent, var(--primary-c));
  transform: scaleX(0);
  transition: transform .24s cubic-bezier(.22, .61, .36, 1);
}

.cate-tab:hover {
  opacity: .92;
}

.cate-tab--active {
  font-weight: 600;
  opacity: 1;
}

.cate-tab--active::after {
  transform: scaleX(1);
}

/* 编辑态：给分类标签一点底色，让站长看出它是可拖拽的块 */
.cate-tab.site--setting {
  border: 0;
  border-radius: 6px 6px 0 0;
  background-color: color-mix(in srgb, var(--main-bg-c) 38%, transparent);
}

.cate-tab.site--select {
  color: var(--wallpaper-accent, var(--primary-c));
  background-color: color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 20%, transparent);
}

@media screen and (max-width: 640px) {
  .cate-nav {
    padding-bottom: 10px;
  }

  .cate-tab {
    padding: 6px 11px 9px;
    font-size: 13px;
  }

  .cate-tab::after {
    right: 9px;
    left: 9px;
  }
}
</style>
