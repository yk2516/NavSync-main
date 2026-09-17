<script setup lang="ts">
import { wallpaperSkins } from '@/stores/wallpaper'

const wallpaperStore = useWallpaperStore()
const fileInput = ref<HTMLInputElement>()
const activeSource = ref<'local' | 'url' | 'gradient'>('local')
const imageUrlInput = ref('')
const gradientInput = ref('linear-gradient(135deg, #ff5364 0%, #ffb347 34%, #36d1dc 100%)')
const imageError = ref('')

const settings = computed(() => wallpaperStore.settings)

function openFilePicker() {
  fileInput.value?.click()
}

function readImage(file: File) {
  imageError.value = ''
  if (!file.type.startsWith('image/')) {
    imageError.value = '请选择图片文件'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    imageError.value = '图片不能超过 8MB'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const source = String(reader.result || '')
    const image = new Image()
    image.onload = () => {
      // 压缩到适合壁纸的尺寸，避免 localStorage 因原图过大而无法保存
      const maxWidth = 1920
      const maxHeight = 1200
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        wallpaperStore.setImage(source, 'local')
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      wallpaperStore.setImage(canvas.toDataURL('image/jpeg', 0.86), 'local')
    }
    image.onerror = () => {
      imageError.value = '图片无法读取'
    }
    image.src = source
  }
  reader.readAsDataURL(file)
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file)
    readImage(file)
  input.value = ''
}

function applyUrl() {
  const value = imageUrlInput.value.trim()
  if (!/^https?:\/\//i.test(value)) {
    imageError.value = '图片链接必须以 http:// 或 https:// 开头'
    return
  }
  imageError.value = ''
  wallpaperStore.setImage(value, 'url')
}

function applyGradient() {
  const value = gradientInput.value.trim()
  if (!value || !/^(linear|radial)-gradient\(/i.test(value)) {
    imageError.value = '请输入 linear-gradient 或 radial-gradient'
    return
  }
  imageError.value = ''
  wallpaperStore.setGradient(value)
}

function randomAccent() {
  const colors = ['#0071e3', '#4f7ff0', '#25c89f', '#24c5d7', '#9e83ee', '#ff9138', '#ef6d6d', '#f6b91e', '#db72e8', '#df68ac', '#35c4b4', '#98dc36']
  wallpaperStore.update({ accent: colors[Math.floor(Math.random() * colors.length)] })
}

function selectRecent(image: string) {
  wallpaperStore.setImage(image, 'local')
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}
</script>

<template>
  <n-modal v-model:show="wallpaperStore.panelVisible" preset="card" :style="{ width: 'min(720px, calc(100vw - 28px))' }" title="壁纸与外观" :bordered="false" :segmented="{ content: true }">
    <div class="wallpaper-panel">
      <section class="wallpaper-section">
        <div class="wallpaper-title">
          皮肤
        </div>
        <div class="skin-grid">
          <button
            v-for="(skin, key) in wallpaperSkins"
            :key="key"
            class="skin-card"
            :class="{ active: settings.skin === key && settings.source === 'none' }"
            type="button"
            @click="wallpaperStore.setSkin(key)"
          >
            <span class="skin-preview" :style="{ background: skin.background }" />
            <span>{{ skin.label }}</span>
          </button>
        </div>
      </section>

      <section class="wallpaper-section accent-row">
        <div>
          <div class="wallpaper-title">
            强调色（Accent）
          </div>
          <div class="accent-controls">
            <input v-model="settings.accent" type="color" aria-label="选择强调色">
            <code>{{ settings.accent }}</code>
            <button type="button" class="outline-button" @click="randomAccent">
              随机
            </button>
          </div>
        </div>
      </section>

      <section class="wallpaper-section">
        <div class="wallpaper-title">
          背景图片（壁纸）
        </div>
        <div class="wallpaper-actions">
          <button type="button" class="outline-button primary" @click="activeSource = 'local'; openFilePicker()">
            选择图片
          </button>
          <button type="button" class="outline-button danger" @click="wallpaperStore.removeWallpaper">
            移除图片
          </button>
          <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFileChange">
        </div>
        <div v-if="settings.recentImages.length" class="recent-row">
          <span class="recent-label">最近使用</span>
          <button v-for="image in settings.recentImages" :key="image" type="button" class="recent-image" @click="selectRecent(image)">
            <img :src="image" alt="最近使用的壁纸">
          </button>
        </div>
        <div v-if="imageError" class="wallpaper-error">
          {{ imageError }}
        </div>
      </section>

      <section class="wallpaper-section">
        <div class="wallpaper-title">
          玻璃效果
        </div>
        <div class="glass-grid">
          <button type="button" class="glass-card" :class="{ active: settings.glass === 'classic' }" @click="wallpaperStore.update({ glass: 'classic' })">
            <span class="glass-demo classic-demo" />
            <strong>毛玻璃</strong>
            <small>经典毛玻璃，动画质感、文字更清晰</small>
          </button>
          <button type="button" class="glass-card" :class="{ active: settings.glass === 'liquid' }" @click="wallpaperStore.update({ glass: 'liquid' })">
            <span class="glass-demo liquid-demo" />
            <strong>液态玻璃</strong>
            <small>通透轻盈、折射感更强、更显壁纸</small>
          </button>
        </div>
      </section>

      <section class="wallpaper-section sliders">
        <label><span>壁纸透明度</span><input v-model.number="settings.wallpaperOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.wallpaperOpacity) }}</b></label>
        <label><span>壁纸模糊</span><input v-model.number="settings.wallpaperBlur" type="range" min="0" max="32"><b>{{ settings.wallpaperBlur }}px</b></label>
        <label><span>侧边栏透明度</span><input v-model.number="settings.sidebarOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.sidebarOpacity) }}</b></label>
        <label><span>输入框透明度</span><input v-model.number="settings.inputOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.inputOpacity) }}</b></label>
        <label><span>弹窗透明度</span><input v-model.number="settings.popupOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.popupOpacity) }}</b></label>
        <label class="checkbox-label"><input v-model="settings.autoDim" type="checkbox"><span>自动弱化（聚焦任务时不喧宾夺主）</span></label>
      </section>

      <section class="wallpaper-section">
        <div class="wallpaper-title">
          高级壁纸（URL / 渐变）
        </div>
        <div class="advanced-tabs">
          <button type="button" :class="{ active: activeSource === 'local' }" @click="activeSource = 'local'">
            本地图片
          </button>
          <button type="button" :class="{ active: activeSource === 'url' }" @click="activeSource = 'url'">
            图片链接
          </button>
          <button type="button" :class="{ active: activeSource === 'gradient' }" @click="activeSource = 'gradient'">
            渐变
          </button>
        </div>
        <div v-if="activeSource === 'url'" class="advanced-input">
          <n-input v-model:value="imageUrlInput" placeholder="https://example.com/wallpaper.jpg" @keydown.enter="applyUrl" />
          <button type="button" class="outline-button primary" @click="applyUrl">
            应用
          </button>
        </div>
        <div v-if="activeSource === 'gradient'" class="advanced-input">
          <n-input v-model:value="gradientInput" placeholder="linear-gradient(135deg, #ff5364, #24c5d7)" @keydown.enter="applyGradient" />
          <button type="button" class="outline-button primary" @click="applyGradient">
            应用
          </button>
        </div>
        <button type="button" class="clear-button" @click="wallpaperStore.removeWallpaper">
          清除壁纸
        </button>
      </section>
    </div>

    <template #footer>
      <div class="wallpaper-footer">
        <span>管理员与访客各自保存本设备的壁纸设置</span>
        <n-button quaternary size="small" @click="wallpaperStore.reset">
          恢复默认
        </n-button>
        <n-button type="primary" text-color="#fff" @click="wallpaperStore.closePanel">
          完成
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style lang="scss" scoped>
.wallpaper-panel {
  max-height: min(70vh, 720px);
  overflow-y: auto;
  padding-right: 4px;
}
.wallpaper-section {
  padding: 16px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--text-c) 14%, transparent);
}
.wallpaper-section:last-child { border-bottom: 0; }
.wallpaper-title { margin-bottom: 10px; font-size: 14px; font-weight: 700; }
.skin-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.skin-card, .glass-card, .advanced-tabs button, .recent-image {
  border: 1px solid color-mix(in srgb, var(--text-c) 18%, transparent);
  background: color-mix(in srgb, var(--main-bg-c) 70%, transparent);
  color: inherit;
  cursor: pointer;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.skin-card { display: grid; gap: 5px; padding: 5px; border-radius: 8px; font-size: 12px; }
.skin-card:hover, .glass-card:hover { transform: translateY(-1px); }
.skin-card.active, .glass-card.active, .advanced-tabs button.active { border-color: var(--wallpaper-accent, var(--primary-c)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 22%, transparent); }
.skin-preview { height: 36px; border-radius: 5px; }
.accent-controls, .wallpaper-actions, .advanced-input, .wallpaper-footer, .recent-row { display: flex; align-items: center; gap: 10px; }
.accent-controls input[type='color'] { width: 36px; height: 28px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.accent-controls code { opacity: .72; }
.outline-button, .clear-button { padding: 6px 12px; border: 1px solid color-mix(in srgb, var(--text-c) 22%, transparent); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.outline-button.primary { color: var(--wallpaper-accent, var(--primary-c)); }
.outline-button.danger, .clear-button { color: #d03050; }
.recent-row { flex-wrap: wrap; margin-top: 12px; }
.recent-label { width: 100%; font-size: 12px; opacity: .62; }
.recent-image { width: 56px; height: 40px; padding: 0; overflow: hidden; border-radius: 5px; }
.recent-image img { width: 100%; height: 100%; object-fit: cover; }
.wallpaper-error { margin-top: 8px; color: #d03050; font-size: 12px; }
.glass-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.glass-card { display: grid; gap: 5px; padding: 10px; text-align: left; border-radius: 8px; }
.glass-card small { opacity: .62; }
.glass-demo { height: 42px; border-radius: 6px; background: linear-gradient(110deg, #ff5364, #ffb347 35%, #36d1dc); border: 4px solid rgba(255, 255, 255, .65); }
.liquid-demo { box-shadow: inset 0 0 20px rgba(255,255,255,.35), 0 4px 12px rgba(20, 100, 180, .15); }
.sliders { display: grid; gap: 11px; }
.sliders label { display: grid; grid-template-columns: 100px 1fr 42px; align-items: center; gap: 10px; font-size: 12px; }
.sliders input[type='range'] { width: 100%; accent-color: var(--wallpaper-accent, var(--primary-c)); }
.sliders b { text-align: right; font-weight: 400; opacity: .72; }
.sliders .checkbox-label { display: flex; grid-template-columns: unset; justify-content: flex-start; }
.advanced-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
.advanced-tabs button { padding: 5px 10px; border-radius: 6px; }
.advanced-input { align-items: stretch; }
.advanced-input :deep(.n-input) { flex: 1; }
.clear-button { width: 100%; margin-top: 12px; }
.wallpaper-footer { justify-content: flex-end; flex-wrap: wrap; }
.wallpaper-footer span { margin-right: auto; font-size: 12px; opacity: .62; }
@media (max-width: 620px) {
  .skin-grid { grid-template-columns: repeat(3, 1fr); }
  .glass-grid { grid-template-columns: 1fr; }
  .sliders label { grid-template-columns: 84px 1fr 40px; }
  .wallpaper-footer span { width: 100%; }
}
</style>
