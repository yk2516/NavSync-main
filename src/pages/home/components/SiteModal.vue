<script setup lang="ts">
import { getFaviconSourceUrl } from '@/utils'

const modalStore = useModalStore()
const wallpaperStore = useWallpaperStore()
const errorInput = ref(false)

/** 图标底色色板：仿极光Tab，最后一个是自定义取色 */
const ICON_COLORS = [
  '#12b76a', '#14b8a6', '#2e90fa', '#6172f3', '#2563eb', '#d4c5a0',
  '#facc15', '#fb923c', '#ef4444', '#ffffff', '#111827', '#78350f',
]

const isSite = computed(() => modalStore.target === 'site')
const previewUrl = computed(() => modalStore.inputValues.url.trim())
const faviconPreviews = computed(() => {
  const url = previewUrl.value
  if (!url)
    return []
  return [
    { key: 'site', label: '网站 favicon.ico', src: getFaviconSourceUrl(url, 'site') },
    { key: 'google', label: 'Google 图标源', src: getFaviconSourceUrl(url, 'google') },
    { key: 'duckduckgo', label: 'DuckDuckGo 图标源', src: getFaviconSourceUrl(url, 'duckduckgo') },
    { key: 'solid', label: '纯色图标（本地）', src: '' },
  ].map(item => ({ ...item, active: item.key === wallpaperStore.settings.faviconSource }))
})

function pickColor(color: string) {
  // 再次点击同一个颜色 = 取消底色（透明）
  modalStore.inputValues.bgColor = modalStore.inputValues.bgColor?.toLowerCase() === color.toLowerCase() ? '' : color
}

function handleAllCommit(_e: Event) {
  if (modalStore.inputValues.name.length <= 0
      || (modalStore.target === 'site' && modalStore.inputValues.url.length <= 0)) {
    errorInput.value = true
    setTimeout(() => errorInput.value = false, 500)
    return
  }
  modalStore.handleCommit()
  setTimeout(() => errorInput.value = false, 500)
}
</script>

<template>
  <n-modal
    v-model:show="modalStore.modalVisible"
    preset="dialog"
    title="Dialog"
    :show-icon="false"
    :closable="false"
    :auto-focus="true"
    :on-after-leave="modalStore.clearInput"
  >
    <template #header>
      <div>{{ modalStore.title }}</div>
    </template>
    <div>
      <n-input
        v-model:value="modalStore.inputValues.name"
        :status="errorInput && modalStore.inputValues.name.length <= 0 ? 'error' : 'success'"
        placeholder="名称"
        my-8
        @keydown.enter="handleAllCommit"
      />
      <n-input
        v-if="isSite"
        v-model:value="modalStore.inputValues.url"
        placeholder="链接"
        my-8
        :status="errorInput && modalStore.inputValues.url.length <= 0 ? 'error' : 'success'"
        @keydown.enter="handleAllCommit"
      />
      <div v-if="isSite && faviconPreviews.length" class="favicon-previews" aria-label="网址图标预览">
        <div class="favicon-previews__title">
          输入网址后可预览图标来源
        </div>
        <div class="favicon-previews__grid">
          <div v-for="item in faviconPreviews" :key="item.key" class="favicon-preview" :class="{ active: item.active }">
            <div class="favicon-preview__image">
              <img v-if="item.src" :src="item.src" :alt="item.label" referrerpolicy="no-referrer">
              <span v-else class="favicon-preview__solid">A</span>
            </div>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>
      <n-input
        v-if="isSite"
        v-model:value="modalStore.inputValues.favicon"
        placeholder="自定义 Favicon（选填，留空自动获取）"
        my-8
        @keydown.enter="handleAllCommit"
      />

      <template v-if="isSite">
        <!-- 图标底色 -->
        <div class="site-icon-label">
          图标底色
        </div>
        <div class="site-icon-colors">
          <button
            type="button"
            class="site-icon-color site-icon-color--none"
            :class="{ active: !modalStore.inputValues.bgColor }"
            title="无底色"
            aria-label="无底色"
            @click="modalStore.inputValues.bgColor = ''"
          />
          <button
            v-for="color in ICON_COLORS"
            :key="color"
            type="button"
            class="site-icon-color"
            :class="{ active: modalStore.inputValues.bgColor?.toLowerCase() === color }"
            :style="{ backgroundColor: color }"
            :title="color"
            :aria-label="`图标底色 ${color}`"
            @click="pickColor(color)"
          />
          <label class="site-icon-color site-icon-color--custom" title="自定义颜色">
            <input
              v-model="modalStore.inputValues.bgColor"
              type="color"
            >
          </label>
        </div>

        <!-- 图标边距 -->
        <div class="site-icon-label">
          图标边距
        </div>
        <div class="site-icon-padding">
          <input v-model.number="modalStore.inputValues.iconPadding" type="range" min="0" max="20" step="1">
          <n-input-number v-model:value="modalStore.inputValues.iconPadding" size="small" :min="0" :max="20" :show-button="false" class="site-icon-padding__num" />
        </div>
      </template>
    </div>
    <template #action>
      <div flex gap-x-12>
        <n-button @click="modalStore.handleCancel">
          取消
        </n-button>
        <n-button v-if="modalStore.action === 'update'" type="error" @click="modalStore.handleDelete">
          删除
        </n-button>
        <n-button type="primary" text-color="#ffffff" @click="handleAllCommit">
          确认
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style lang="scss" scoped>
.favicon-previews {
  margin: -2px 0 12px;
}

.favicon-previews__title {
  margin-bottom: 6px;
  font-size: 12px;
  opacity: .62;
}

.favicon-previews__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.favicon-preview {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  padding: 5px 3px;
  border: 1px solid color-mix(in srgb, var(--text-c) 16%, transparent);
  border-radius: 6px;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  opacity: .72;
}

.favicon-preview.active {
  border-color: var(--wallpaper-accent, var(--primary-c));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 18%, transparent);
  opacity: 1;
}

.favicon-preview__image {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 7px;
  background: color-mix(in srgb, var(--text-c) 9%, transparent);
}

.favicon-preview__image img,
.favicon-preview__solid {
  width: 22px;
  height: 22px;
  border-radius: 5px;
}

.favicon-preview__image img {
  object-fit: contain;
}

.favicon-preview__solid {
  display: grid;
  place-items: center;
  background: #4b5563;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.site-icon-label {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.site-icon-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.site-icon-color {
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--text-c) 20%, transparent);
  border-radius: 50%;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease;
}

.site-icon-color:hover {
  transform: scale(1.12);
}

.site-icon-color.active {
  box-shadow: 0 0 0 2px var(--main-bg-c), 0 0 0 4px var(--wallpaper-accent, var(--primary-c));
}

/* 无底色：白底 + 斜杠 */
.site-icon-color--none {
  background:
    linear-gradient(135deg, transparent 46%, #ef4444 46%, #ef4444 54%, transparent 54%),
    #fff;
}

/* 自定义：彩虹圈 + 内嵌原生取色器 */
.site-icon-color--custom {
  display: block;
  overflow: hidden;
  background: conic-gradient(#ef4444, #facc15, #12b76a, #2e90fa, #8b5cf6, #ef4444);
}

.site-icon-color--custom input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.site-icon-padding {
  display: flex;
  align-items: center;
  gap: 12px;
}

.site-icon-padding input[type='range'] {
  flex: 1;
  accent-color: var(--wallpaper-accent, var(--primary-c));
}

.site-icon-padding__num {
  width: 76px;
  flex: 0 0 76px;
}
</style>
