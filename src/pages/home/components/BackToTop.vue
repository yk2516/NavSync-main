<script setup lang="ts">
/**
 * 右下角「返回顶部」。
 *
 * 为什么需要它：浏览态默认的紧凑列表是**一整页长滚动**（全部分组纵向铺开），
 * 翻到页面中部想回顶部只能一路滚回去 —— 尤其手机上很烦。
 *
 * 位置与小风车（`WallpaperFan.vue`，右下角 22px / 42px）上下叠放，
 * 不抢同一块地方：小风车在 `bottom: 22px`，这里在 `bottom: 78px`。
 *
 * 只在滚过阈值后出现 —— 页面本来就没滚动时挂一个大按钮在右下角是纯噪声。
 * 隐藏时用 `inert` 摘出可聚焦序列，否则键盘用户会 Tab 到一个看不见的按钮。
 */

const visible = ref(false)

/** 出现阈值（px）：滚过一屏的 1/4 左右才值得给入口 */
const SHOW_AFTER = 240

// rAF 节流：scroll 事件的触发频率远高于一帧一次，直接写响应式会白跑很多次
let rafId = 0

function sync() {
  rafId = 0
  visible.value = window.scrollY > SHOW_AFTER
}

function onScroll() {
  if (!rafId)
    rafId = requestAnimationFrame(sync)
}

// 无条件注册、回调里自己判断（硬约定 29：条件注册的监听会静默失效）
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  sync()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId)
    cancelAnimationFrame(rafId)
})

function toTop() {
  const reduce = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}
</script>

<template>
  <button
    type="button"
    class="back-to-top"
    :class="{ 'back-to-top--visible': visible }"
    :inert="!visible || undefined"
    title="返回顶部"
    aria-label="返回顶部"
    @click="toTop"
  >
    <span class="back-to-top__icon" i-carbon:arrow-up />
  </button>
</template>

<style lang="scss" scoped>
.back-to-top {
  position: fixed;
  /* 叠在小风车上方（小风车 bottom: 22px + 42px 高 = 64px） */
  right: 22px;
  bottom: 78px;
  z-index: 901;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  /* ⚠️ 底色写在**按钮**上，图标元素只给 `color` ——
   * presetIcons 靠 `background-color: currentColor` + mask 画图标，
   * 给图标元素写背景会把 currentColor 顶掉，图标直接消失（硬约定 12）。 */
  color: #fff;
  background-image: linear-gradient(135deg,
      var(--wallpaper-accent, var(--primary-c)) 0%,
      color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 68%, #000) 100%);
  box-shadow:
    0 10px 26px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 42%, transparent),
    0 2px 6px rgba(15, 23, 42, .22);
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px) scale(.86);
  pointer-events: none;
  transition: opacity .24s ease, transform .24s cubic-bezier(.34, 1.4, .64, 1), box-shadow .2s ease;
}

.back-to-top--visible {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.back-to-top:hover {
  transform: translateY(-3px);
  box-shadow:
    0 14px 32px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 52%, transparent),
    0 3px 8px rgba(15, 23, 42, .26);
}

.back-to-top:active {
  transform: translateY(-1px) scale(.96);
}

/* 纯图标控件必须能被键盘找到并看见焦点 */
.back-to-top:focus-visible {
  outline: 2px solid var(--wallpaper-accent, var(--primary-c));
  outline-offset: 3px;
}

.back-to-top__icon {
  width: 24px;
  height: 24px;
}

@media screen and (max-width: 640px) {
  .back-to-top {
    right: 14px;
    bottom: 66px;
    width: 44px;
    height: 44px;
  }

  .back-to-top__icon {
    width: 22px;
    height: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .back-to-top {
    transition: opacity .2s ease;
    transform: none;
  }
}
</style>
