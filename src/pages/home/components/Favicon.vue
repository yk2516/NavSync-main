<script setup lang="ts">
import type { PropType } from 'vue'
import { getFaviconUrl, getRandomDarkColor, safeFaviconUrl } from '@/utils'
import type { Site } from '@/types'

const props = defineProps({
  site: {
    type: Object as PropType<Site>,
    required: true,
  },
})

const { iconStyle } = useIconStyle()

const isGen = ref(false)
const imgLoaded = ref(false)

// 组件实例复用时（列表更新/切换 site），重置图片加载状态，避免旧站点的状态残留
watch(() => props.site, () => {
  isGen.value = false
  imgLoaded.value = false
}, { deep: true })

function handleFaviconError(site: Site) {
  isGen.value = true
  // 直接修改响应式 site 对象（其已在 store 数据中，天然响应式），
  // 避免依赖全局 cateIndex/groupIndex/siteIndex 造成多站点并发加载时的索引竞争
  if (site.bgColor)
    return
  site.bgColor = getRandomDarkColor()
}

// 图标底色与边距由站点自己携带（站长在编辑弹窗里设置，仿极光Tab）
const boxStyle = computed(() => {
  const bg = props.site.bgColor?.trim()
  const padding = Number(props.site.iconPadding ?? 0)
  return {
    backgroundColor: bg || 'transparent',
    padding: `${Number.isFinite(padding) ? Math.max(0, Math.min(24, padding)) : 0}px`,
  }
})

// 图片样式 = 图标风格（鲜艳/朴素/灰白）+ 加载淡入
const imgStyle = computed(() => {
  const raw = iconStyle.value
  const base: Record<string, any> = (raw && typeof raw === 'object') ? { ...(raw as Record<string, any>) } : {}
  if (!imgLoaded.value)
    base.opacity = '0'
  base.transition = 'opacity 0.3s'
  return base
})
</script>

<template>
  <!-- 尺寸/圆角/不透明度来自壁纸面板的全局设置（CSS 变量），
       底色与边距来自站点自身的设置 -->
  <div class="favicon-box" :style="boxStyle">
    <div v-if="!isGen && !imgLoaded" class="favicon-skeleton" />
    <img
      v-if="!isGen"
      class="favicon-image"
      :src="safeFaviconUrl(site.favicon) || getFaviconUrl(site.url)"
      decoding="async"
      loading="lazy"
      :style="imgStyle"
      @error="handleFaviconError(site)"
      @load="imgLoaded = true"
    >
    <div v-else class="favicon-fallback" :style="{ backgroundColor: site.bgColor || '#4b5563' }">
      {{ site.name.length > 0 ? site.name.toLocaleUpperCase().charAt(0) : 'c' }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 尺寸与圆角走 CSS 变量，站长/访客都能在壁纸面板里实时调 */
.favicon-box {
  width: var(--wallpaper-icon-size, 64px);
  height: var(--wallpaper-icon-size, 64px);
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: var(--wallpaper-icon-radius, 12px);
  opacity: var(--wallpaper-icon-opacity, 1);
  transition: width .2s ease, height .2s ease, border-radius .2s ease, opacity .2s ease, background-color .2s ease;
}

.favicon-skeleton,
.favicon-image,
.favicon-fallback {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.favicon-skeleton {
  background: var(--setting-group-bg-c);
  animation: favicon-pulse 1.4s ease-in-out infinite;
}

.favicon-image {
  display: block;
  object-fit: contain;
}

.favicon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(var(--wallpaper-icon-size, 64px) * 0.375);
  line-height: 1;
  transform: scale(.92);
}

@keyframes favicon-pulse {
  0%, 100% { opacity: .45; }
  50% { opacity: .85; }
}
</style>
