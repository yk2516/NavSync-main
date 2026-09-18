<script setup lang="ts">
import { ensureReadPermission, listImagesInDirectory, loadWallpaperDirectory } from '@/utils'

const wallpaperStore = useWallpaperStore()

const spinning = ref(false)

/**
 * 小风车：点一下随机换一张壁纸。
 * 优先用「选择文件夹」授权的图片；没有文件夹就按壁纸源网站重新拉一张。
 */
async function spin() {
  if (spinning.value)
    return
  spinning.value = true
  try {
    // 刷新后目录句柄还在，但权限会退回 prompt；点击本身就是用户手势，可以在这里重新授权
    if (!wallpaperStore.folderImages.length) {
      const handle = await loadWallpaperDirectory()
      if (handle && await ensureReadPermission(handle)) {
        const files = await listImagesInDirectory(handle)
        if (files.length)
          wallpaperStore.setFolderImages(files, handle.name || wallpaperStore.settings.folderName)
      }
    }

    const result = wallpaperStore.shuffleWallpaper()
    if (result === 'none')
      window.$message?.info('还没有可切换的壁纸，先在「壁纸与外观」里选图片、文件夹或壁纸源', { duration: 3200 })
  }
  catch {
    window.$message?.error('换壁纸失败，请检查文件夹权限或壁纸源', { duration: 3200 })
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
    :title="wallpaperStore.folderImages.length ? '从壁纸文件夹随机换一张' : '随机换一张壁纸'"
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
