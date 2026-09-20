<script setup lang="ts">
const wallpaperStore = useWallpaperStore()

const spinning = ref(false)

/**
 * 小风车：点一下随机换一套皮肤或渐变。
 *
 * 2026-09-20 起壁纸只剩「皮肤 / 渐变 / 无」三种形态（本地图片、壁纸文件夹、
 * 壁纸源网站都已按用户要求移除），所以这里**没有任何异步依赖** ——
 * 不读 IndexedDB、不发请求、不等权限，纯同步切换。
 * 原来的 `restoreFolderImages` / `withTimeout` / 目录句柄恢复逻辑一并删除。
 */
function spin() {
  if (spinning.value)
    return
  spinning.value = true
  try {
    const result = wallpaperStore.shuffleWallpaper()
    if (result === 'none')
      window.$message?.info('还没有可切换的皮肤或渐变，先去「壁纸与外观」里加几个', { duration: 3200 })
  }
  finally {
    setTimeout(() => spinning.value = false, 620)
  }
}
</script>

<template>
  <button
    type="button"
    class="wallpaper-fan"
    :class="{ 'wallpaper-fan--spinning': spinning }"
    title="随机换一套皮肤或渐变"
    aria-label="随机换一套皮肤或渐变"
    @click="spin"
  >
    <span class="wallpaper-fan__icon" i-cus:fan />
  </button>
</template>

<style lang="scss" scoped>
.wallpaper-fan {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--text-c) 14%, transparent);
  border-radius: 50%;
  color: var(--text-c);
  cursor: pointer;
  background-color: color-mix(in srgb, var(--main-bg-c) 62%, transparent);
  backdrop-filter: blur(12px) saturate(130%);
  -webkit-backdrop-filter: blur(12px) saturate(130%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, .16);
  opacity: .86;
  transition: opacity .2s ease, transform .2s ease, color .2s ease;
}

.wallpaper-fan:hover {
  opacity: 1;
  color: var(--wallpaper-accent, var(--primary-c));
  transform: translateY(-2px);
}

.wallpaper-fan__icon {
  width: 22px;
  height: 22px;
  transition: transform .6s cubic-bezier(.34, 1.4, .64, 1);
}

.wallpaper-fan--spinning .wallpaper-fan__icon {
  transform: rotate(360deg);
}

@media screen and (max-width: 640px) {
  .wallpaper-fan {
    right: 14px;
    bottom: 14px;
    width: 38px;
    height: 38px;
  }

  .wallpaper-fan__icon {
    width: 20px;
    height: 20px;
  }
}
</style>
