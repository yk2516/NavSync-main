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
                'group__header--setting': settingStore.isWhiteTheme,
                'group__header--setting--colorful': !settingStore.isWhiteTheme,
                'site--setting': settingStore.isSetting,
              }" md="text-15" lg="text-15" shrink-0 whitespace-nowrap px-0 py-4 text-13 op-80 overflow-hidden ellipsis @click="handleGroupClick(i)"
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
                  <n-button class="h-full" type="primary" secondary :focusable="false" @click="modalStore.showModal('add', 'site', i)">
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
      <n-button type="primary" secondary w-full :focusable="false" @click="modalStore.showModal('add', 'group')">
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

.group__header--setting {
  background-color: var(--setting-group-bg-c);
  color: var(--text-c);
  margin: 0 2px;
  padding: 4px;
  border-radius: 2px;
}

.group__header--setting--colorful {
  background-color: var(--setting-group-bg-c);
  color: var(--primary-c);
  margin: 0 2px;
  padding: 4px;
  border-radius: 2px;
}

.group__header--all {
  max-width: 10%;
  overflow: hidden;
  align-items: center;
  flex: 0 0 10%;
}

.site--setting:hover {
  background-color: var(--site-hover-c);
}

.group__content--all {
  flex: 0 0 90%;
  max-width: 90%;
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
