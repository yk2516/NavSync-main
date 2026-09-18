<script setup lang="ts">
import draggable from 'vuedraggable'
import Favicon from './Favicon.vue'
import type { Group, Site } from '@/types'

const modalStore = useModalStore()
const siteStore = useSiteStore()
const route = useRoute()

// 安全获取当前分类的 groupList（空值保护，避免导入空数据后 data[0] 为 undefined 导致白屏）
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
      }"
      v-bind="draggableOptions"
      @start="handleStart"
      @end="handleEnd"
    >
      <template #item="{ element: group, index: i }: { element: Group, index: number }">
        <div
          :class="{
            'group__header--line': currentGroupList.length !== i + 1,
          }"
          flex style="align-items: center;"
        >
          <!-- Group header -->
          <div class="group__header--all" grid justify-start>
            <span
              class="group__handle" :class="{
                'cursor-pointer': settingStore.isSetting,
                'site--setting': settingStore.isSetting,
              }" shrink-0 whitespace-nowrap @click="handleGroupClick(i)"
            >
              {{ group.name }}
            </span>
          </div>
          <!-- Group content -->
          <div flex class="group__content--all">
            <draggable
              :list="currentGroupList[i].siteList"
              item-key="id"
              group="site"
              handle=".site__handle"
              drag-class="dragging"
              :component-data="{
                tag: 'div',
                type: 'transition-group',
                class: 'grid gap-8 grid-cols-3 md:gap-12 lg:gap-12 xl:gap-12 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6',
              }"
              v-bind="draggableOptions"
              flex
              style="flex: 0 0 100%;"
              @start="handleStart"
              @end="handleEnd"
            >
              <template #item="{ element: site, index }: { element: Site, index: number }">
                <div>
                  <!-- Site item：图标在上、名称在下的纵向卡片 -->
                  <a
                    class="site__handle site-card"
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
                <div v-if="!settingStore.isDragging && settingStore.isSetting && currentGroupList[i].siteList.length < 6" min-h-32>
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
        </div>
      </template>
    </draggable>
    <!-- Add group button -->
    <div v-if="addGroupVisible" my-20 md="my-32" lg="my-32">
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
/* 纵向站点卡片：图标在上、名称在下（原先的左图右文观感很差） */
.site-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color .18s ease, transform .18s ease;
}

.site-card:not(.site-card--dragging):hover {
  background-color: var(--site-hover-c);
  transform: translateY(-2px);
}

.site-card__name {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
  font-size: 13px;
  line-height: 1.25;
  opacity: .85;
}

.site--setting {
  border: 1px dashed var(--setting-border-c);
  border-radius: 12px;
}

/* 二级分组标题：去掉原先的低对比色块，改成「强调色竖条 + 高对比文字 + 半透明胶囊底」，
 * 在壁纸上也看得清，比之前的青色小字显眼。 */
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

.group__header--all {
  max-width: 12%;
  overflow: hidden;
  align-items: center;
  flex: 0 0 12%;
}

.site--setting:hover {
  background-color: var(--site-hover-c);
}

.group__content--all {
  flex: 0 0 88%;
  max-width: 88%;
}

.group__header--line {
  margin-bottom: 10rem;
}

@media screen and (max-width: 767px) {
  .group__header--all {
    max-width: 15%;
    flex: 0 0 15%;
  }

  .group__content--all {
    flex: 0 0 85%;
    max-width: 85%;
  }

  .group__header--line {
    margin-bottom: 4rem;
  }
}
</style>
