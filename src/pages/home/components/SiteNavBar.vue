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
        <!-- 一级分类：胶囊标签。实心强调色底 + 白字，比原先的低对比下划线显眼得多 -->
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
  padding-bottom: 26px;
}

.cate-nav__list {
  display: flex;
  gap: 8px;
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

.cate-tab {
  flex: 0 0 auto;
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  /* 未选中：靠半透明底 + 高不透明度文字保证在壁纸上也看得清 */
  color: var(--text-c);
  background-color: color-mix(in srgb, var(--main-bg-c) 42%, transparent);
  transition: background-color .2s ease, color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.cate-tab:hover {
  color: var(--text-c);
  background-color: color-mix(in srgb, var(--main-bg-c) 68%, transparent);
  transform: translateY(-1px);
}

.cate-tab--active {
  color: #fff;
  font-weight: 600;
  background-color: var(--wallpaper-accent, var(--primary-c));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 40%, transparent);
}

.cate-tab--active:hover {
  color: #fff;
  background-color: var(--wallpaper-accent, var(--primary-c));
}

.site--setting {
  border: 1px dashed var(--setting-border-c);
  border-radius: 999px;
}

.site--select {
  background-color: var(--setting-group-bg-c);
  color: var(--primary-c);
}

@media screen and (max-width: 640px) {
  .cate-nav {
    padding-bottom: 18px;
  }

  .cate-tab {
    padding: 6px 13px;
    font-size: 13px;
  }
}
</style>
