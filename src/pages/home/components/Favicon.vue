<script setup lang="ts">
import type { PropType } from 'vue'
import { getFaviconUrl, getRandomDarkColor } from '@/utils'
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
</script>

<template>
  <!-- 上游资源固定按 80x80 请求，页面固定 64x64 渲染，避免 Favicon 过小 -->
  <div class="favicon-box" :style="iconStyle">
    <div v-if="!isGen && !imgLoaded" class="favicon-skeleton" />
    <img
      v-if="!isGen"
      class="favicon-image"
      :src="site.favicon || getFaviconUrl(site.url)"
      decoding="async"
      loading="lazy"
      :style="{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }"
      @error="handleFaviconError(site)"
      @load="imgLoaded = true"
    >
    <div v-else class="favicon-fallback" :style="{ backgroundColor: site.bgColor }">
      {{ site.name.length > 0 ? site.name.toLocaleUpperCase().charAt(0) : 'c' }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.favicon-box,
.favicon-skeleton,
.favicon-image,
.favicon-fallback {
  width: 64px;
  height: 64px;
}

.favicon-box {
  flex: 0 0 64px;
  overflow: hidden;
  border-radius: 12px;
}

.favicon-skeleton {
  background: var(--setting-group-bg-c);
  border-radius: 12px;
  animation: favicon-pulse 1.4s ease-in-out infinite;
}

.favicon-image {
  display: block;
  object-fit: contain;
  border-radius: 12px;
}

.favicon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
  font-size: 24px;
  line-height: 1;
  transform: scale(.92);
}

@keyframes favicon-pulse {
  0%, 100% { opacity: .45; }
  50% { opacity: .85; }
}
</style>
