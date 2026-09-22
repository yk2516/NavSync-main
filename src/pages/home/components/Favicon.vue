<script setup lang="ts">
import type { PropType } from 'vue'
import { getFaviconSourceUrl, getRandomDarkColor, resolveFaviconUrl } from '@/utils'
import type { FaviconSource, Site } from '@/types'

const props = defineProps({
  site: {
    type: Object as PropType<Site>,
    required: true,
  },
})

const wallpaperStore = useWallpaperStore()

const imgLoaded = ref(false)
const failedFaviconKey = ref('')

const faviconSource = computed<FaviconSource>(() => wallpaperStore.settings.faviconSource || 'site')
const hasCustomFavicon = computed(() => {
  const raw = (props.site.favicon || '').trim()
  if (!raw)
    return false
  // 旧代理地址需要在读取时按当前图标源自愈；普通同域相对路径则是用户明确填写的自定义图标，必须保留。
  if (/^\/favicon\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\.png/.test(raw))
    return false
  return ![resolveFaviconUrl('', props.site.url), resolveFaviconUrl('', props.site.url, 'site'), resolveFaviconUrl('', props.site.url, 'google'), resolveFaviconUrl('', props.site.url, 'duckduckgo')].includes(raw)
})
const hasLegacyFavicon = computed(() => /^\/favicon\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\.png/.test((props.site.favicon || '').trim()))
const hasStoredFavicon = computed(() => hasCustomFavicon.value || hasLegacyFavicon.value)
const isSolid = computed(() => faviconSource.value === 'solid' && !hasStoredFavicon.value)
const faviconUrl = computed(() => hasStoredFavicon.value
  ? resolveFaviconUrl(props.site.favicon, props.site.url, faviconSource.value)
  : getFaviconSourceUrl(props.site.url, faviconSource.value))
const faviconKey = computed(() => `${props.site.url}|${faviconSource.value}|${faviconUrl.value}`)
const isGen = computed(() => isSolid.value || failedFaviconKey.value === faviconKey.value)

// 组件实例复用时（列表更新/切换 site），重置图片加载状态，避免旧站点的状态残留
function resetFavicon() {
  failedFaviconKey.value = ''
  imgLoaded.value = false
}

watch(() => props.site, resetFavicon, { deep: true })
watch(faviconSource, resetFavicon)

function handleFaviconError(site: Site) {
  failedFaviconKey.value = faviconKey.value
  // 直接修改响应式 site 对象（其已在 store 数据中，天然响应式），
  // 避免依赖全局 cateIndex/groupIndex/siteIndex 造成多站点并发加载时的索引竞争
  if (site.bgColor)
    return
  site.bgColor = getRandomDarkColor()
}

// 图标底色与边距由站点自己携带（站长在编辑弹窗里设置，仿极光Tab）
//
// ⚠️ 内边距只在**站点显式设过**（> 0）时才写 inline style。
// 旧写法是 `padding: ${n}px` 无条件写死（默认 0），inline 优先级高于样式表，
// 会把全局的 `--wallpaper-icon-padding` 彻底盖掉 —— 壁纸面板里的「图标内边距」
// 拖了没反应。留白交给全局变量、站点想单独加再写 inline，两边都不丢。
const boxStyle = computed(() => {
  const bg = props.site.bgColor?.trim()
  const padding = Number(props.site.iconPadding ?? 0)
  const style: Record<string, string> = { backgroundColor: bg || 'transparent' }
  if (Number.isFinite(padding) && padding > 0)
    style.padding = `${Math.min(24, padding)}px`
  return style
})

// 图片样式 = 加载淡入（图标风格已下线：朴素/鲜艳/灰白 等滤镜不再应用）
const imgStyle = computed(() => {
  if (!imgLoaded.value)
    return { opacity: 0, transition: 'opacity 0.3s' }
  return { transition: 'opacity 0.3s' }
})
</script>

<template>
  <!-- 尺寸/圆角/不透明度来自壁纸面板的全局设置（CSS 变量），
       底色与边距来自站点自身的设置 -->
  <div class="favicon-box" :style="boxStyle" :data-favicon-url="faviconUrl">
    <div v-if="!isSolid && !isGen && !imgLoaded" class="favicon-skeleton" />
    <img
      v-if="!isSolid && !isGen"
      :key="`${site.url}-${faviconSource}-${faviconUrl}`"
      class="favicon-image"
      :src="faviconUrl"
      decoding="async"
      loading="lazy"
      referrerpolicy="no-referrer"
      :style="imgStyle"
      @error="handleFaviconError(site)"
      @load="imgLoaded = true"
    >
    <div v-if="isSolid || isGen" class="favicon-fallback" :style="{ backgroundColor: site.bgColor || '#4b5563' }">
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
  /* 四周留白：`--wallpaper-icon-padding` 由 store 按「图标盒 × 百分比」换算成 px 注入。
   * `border-box`（全局 reset）下它不改变盒子尺寸，只把图片绘制区内缩 ——
   * 于是同一张 32px 的源图不再被拉伸铺满，观感立刻锐利一档。
   * fallback 给 0：变量尚未注入时（首帧、旧缓存）退回原来的铺满行为，不跳变。 */
  padding: var(--wallpaper-icon-padding, 0px);
  /* ⚠️ 底色必须只画在内容区，padding 那一圈保持透明。
   *
   * 站点底色（`site.bgColor`，站长手设、或图标加载失败时随机兜底的那个深色）
   * 是画在这个盒子上的。一旦有了留白，底色就会从图片四周**露出一整圈「色环」**——
   * 所有曾经加载失败过一次的站点都会被随机深色染上一圈，比不留白还难看。
   * `content-box` 让背景随图片一起内缩，圆角也按内容区收缩，两者严丝合缝。 */
  background-clip: content-box;
  opacity: var(--wallpaper-icon-opacity, 1);
  transition: width .2s ease, height .2s ease, border-radius .2s ease, opacity .2s ease, background-color .2s ease, padding .2s ease;
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
