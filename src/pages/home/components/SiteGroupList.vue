<script setup lang="ts">
import draggable from 'vuedraggable'
import Favicon from './Favicon.vue'
import type { Group, Site } from '@/types'

/**
 * 编辑态（/setting，且已通过口令）专用视图。
 *
 * 浏览态改用 SitePager.vue 的「一个分组一页 + 滚轮翻页」，那种布局下分组标题
 * 在页面内，无法作为拖拽手柄，跨分组拖动站点也就没法做了。所以这里保留纵向
 * 堆叠：每个分组标题置顶、网格在下，全部平铺出来，拖拽体验和改造前一致。
 *
 * 注意：下面两个 #item 插槽里都不能出现「作为插槽直接子节点」的模板注释 ——
 * dev 模式下 Vue 会把注释编译成真实的注释 vnode，插槽就变成两个根节点，
 * vuedraggable 会抛 "Item slot must have only one child" 并把错误栈当红字画出来。
 */

const modalStore = useModalStore()
const siteStore = useSiteStore()
const route = useRoute()

const currentGroupList = computed(() => siteStore.currentCateData.groupList)

function handleSiteClick(url: string, groupIndex: number, siteIndex: number, e: Event) {
  if (route.name === 'setting') {
    e.preventDefault()
    modalStore.showModal('update', 'site', groupIndex, siteIndex)
  }
}

function handleGroupClick(groupIndex: number) {
  if (route.name === 'setting')
    modalStore.showModal('update', 'group', groupIndex)
}

const addGroupVisible = computed(() => route.name === 'setting' && siteStore.data.length > 0)
const { draggableOptions, handleStart, handleEnd } = useDrag()

const settingStore = useSettingStore()
const renderStore = useRenderStore()
</script>

<template>
  <section :key="renderStore.siteGroupListKey" pb-14 text-14 md="text-15" lg="text-15">
    <draggable
      :list="currentGroupList"
      item-key="id"
      handle=".group__handle"
      drag-class="dragging"
      :component-data="{
        tag: 'div',
        type: 'transition-group',
        class: 'group-list',
      }"
      v-bind="draggableOptions"
      @start="handleStart"
      @end="handleEnd"
    >
      <template #item="{ element: group, index: i }: { element: Group, index: number }">
        <div class="group-block">
          <div class="group-block__head">
            <span
              class="group__handle" :class="{
                'cursor-pointer': settingStore.isSetting,
                'site--setting': settingStore.isSetting,
              }"
              @click="handleGroupClick(i)"
            >
              {{ group.name }}
            </span>
          </div>
          <draggable
            :list="currentGroupList[i].siteList"
            item-key="id"
            group="site"
            handle=".site__handle"
            drag-class="dragging"
            :component-data="{
              tag: 'div',
              type: 'transition-group',
              class: 'site-grid',
            }"
            v-bind="draggableOptions"
            @start="handleStart"
            @end="handleEnd"
          >
            <template #item="{ element: site, index }: { element: Site, index: number }">
              <div>
                <a
                  class="site-card site__handle"
                  :class="{
                    'site--setting': settingStore.isSetting,
                    'site-card--dragging': settingStore.isDragging,
                  }"
                  :href="site.url" target="_blank"
                  :title="site.name"
                  @click="e => handleSiteClick(site.url, i, index, e)"
                >
                  <Favicon :site="site" />
                  <span class="site-card__name">{{ site.name }}</span>
                </a>
              </div>
            </template>
            <template #footer>
              <!-- 不再限制「每分组 6 个」：容量现在由布局决定，超出部分浏览态会自动续页 -->
              <div v-if="!settingStore.isDragging" class="group-block__add">
                <n-button
                  class="h-full" type="primary" secondary :focusable="false"
                  title="添加站点" aria-label="添加站点"
                  @click="modalStore.showModal('add', 'site', i)"
                >
                  <template #icon>
                    <div i-carbon:add />
                  </template>
                </n-button>
              </div>
            </template>
          </draggable>
        </div>
      </template>
    </draggable>

    <div v-if="addGroupVisible" my-20 md="my-32 lg:my-32">
      <n-button
        type="primary" secondary w-full :focusable="false"
        title="添加分组" aria-label="添加分组"
        @click="modalStore.showModal('add', 'group')"
      >
        <template #icon>
          <div i-carbon:add />
        </template>
      </n-button>
    </div>
  </section>
</template>

<style lang="scss" scoped>
/* 分组块：标题置顶 + 网格在下。原先标题占左侧 12% 竖排，
 * 在壁纸上既挤又难读，用户明确要求取消这条侧边栏。 */
.group-block + .group-block {
  margin-top: 40px;
}

.group-block__head {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.group-block__add {
  min-height: 32px;
}

/* 二级分组标题：强调色竖条 + 高对比文字 + 半透明胶囊底，在壁纸上也看得清 */
.group__handle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 10px;
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  color: var(--text-c);
  background-color: color-mix(in srgb, var(--main-bg-c) 46%, transparent);
  transition: background-color .2s ease, color .2s ease;
}

.group__handle::before {
  content: '';
  flex: 0 0 auto;
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background-color: var(--wallpaper-accent, var(--primary-c));
}

.group__handle:hover {
  background-color: color-mix(in srgb, var(--main-bg-c) 72%, transparent);
}

.group__handle.site--setting {
  border-radius: 8px;
}

@media screen and (max-width: 767px) {
  .group-block + .group-block {
    margin-top: 24px;
  }
}
</style>
