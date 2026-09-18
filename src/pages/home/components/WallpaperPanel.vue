<script setup lang="ts">
import { wallpaperSkins } from '@/stores/wallpaper'
import { WALLPAPER_SOURCES, forgetWallpaperDirectory, isFolderPickerSupported, listImagesInDirectory, pickWallpaperDirectory } from '@/utils'

const wallpaperStore = useWallpaperStore()
const fileInput = ref<HTMLInputElement>()
const activeSource = ref<'local' | 'url' | 'gradient'>('local')
const imageUrlInput = ref('')
const gradientInput = ref('linear-gradient(135deg, #ff5364 0%, #ffb347 34%, #36d1dc 100%)')
const imageError = ref('')

const settings = computed(() => wallpaperStore.settings)
const folderSupported = isFolderPickerSupported()

/**
 * n-drawer（naive-ui 2.34）自身没有 Esc 关闭逻辑 —— 源码里搜不到 Escape，
 * 而抽屉带 role="dialog" aria-modal="true"，键盘用户不该只能一路 Tab 去找右上角的 ×。
 * 这里自己挂一个全局 Esc 监听，只在面板打开时生效。
 */
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape')
    return
  e.stopPropagation()
  wallpaperStore.closePanel()
}

watch(() => wallpaperStore.panelVisible, (visible) => {
  if (visible)
    window.addEventListener('keydown', onPanelKeydown)
  else
    window.removeEventListener('keydown', onPanelKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onPanelKeydown))

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
      // 压缩到适合壁纸的尺寸。localStorage 通常只有 5MB 配额，且「最近使用」
      // 会额外存多张，尺寸/质量放太宽会导致写入静默失败、刷新后壁纸丢失。
      const maxWidth = 1600
      const maxHeight = 1000
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
      wallpaperStore.setImage(canvas.toDataURL('image/jpeg', 0.82), 'local')
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

async function chooseFolder() {
  imageError.value = ''
  if (!folderSupported) {
    imageError.value = '当前浏览器不支持选择文件夹（建议用 Chrome / Edge）'
    return
  }
  const handle = await pickWallpaperDirectory()
  if (!handle)
    return

  wallpaperStore.folderBusy = true
  try {
    const files = await listImagesInDirectory(handle)
    if (!files.length) {
      imageError.value = '该文件夹里没有找到图片'
      return
    }
    wallpaperStore.setFolderImages(files, handle.name)
    wallpaperStore.useFolderImage()
    window.$message?.success(`已读取 ${files.length} 张图片，点右下角小风车随机换`, { duration: 3000 })
  }
  finally {
    wallpaperStore.folderBusy = false
  }
}

/**
 * 清除壁纸文件夹。
 * 除了清掉内存里的图片与 folderName，还必须把 IndexedDB 里的目录句柄一并删除 ——
 * 否则句柄会一直留在本机（小风车的恢复逻辑虽然被 folderName 挡住、不会读回它，
 * 但「清除」就该真的清干净）。
 */
async function clearFolder() {
  await forgetWallpaperDirectory()
  wallpaperStore.releaseFolderImages()
  wallpaperStore.update({ folderName: '' })
}

function applyWallpaperSource() {
  imageError.value = ''
  if (settings.value.imageSource === 'custom' && !settings.value.customSource.trim()) {
    imageError.value = '请先填写自定义壁纸地址模板'
    return
  }
  if (!wallpaperStore.useSourceWallpaper())
    imageError.value = '无法生成壁纸地址，请检查来源设置'
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

/** 每页图标数 = 行 × 列，面板里给用户一个直观反馈 */
const perPageCount = computed(() => {
  const rows = Math.max(1, Math.round(settings.value.layoutRows || 1))
  const cols = Math.max(1, Math.round(settings.value.layoutCols || 1))
  return rows * cols
})

/** 一键回到「2 行 × 5 列」的推荐布局 */
function resetLayout() {
  wallpaperStore.update({ layoutRows: 2, layoutCols: 5, layoutColGap: 30, layoutRowGap: 30 })
}
</script>

<template>
  <n-drawer
    v-model:show="wallpaperStore.panelVisible"
    placement="right"
    :width="430"
    :show-mask="false"
    :block-scroll="false"
    :trap-focus="false"
    :auto-focus="false"
    resizable
    to="body"
  >
    <n-drawer-content title="壁纸与外观" closable :native-scrollbar="false" body-content-style="padding: 0 20px;">
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

        <section class="wallpaper-section">
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
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title">
            背景图片（壁纸）
          </div>
          <div class="wallpaper-actions">
            <button type="button" class="outline-button primary" @click="activeSource = 'local'; openFilePicker()">
              选择图片
            </button>
            <button
              v-if="folderSupported"
              type="button"
              class="outline-button primary"
              :disabled="wallpaperStore.folderBusy"
              @click="chooseFolder"
            >
              {{ wallpaperStore.folderBusy ? '读取中…' : '选择文件夹' }}
            </button>
            <button type="button" class="outline-button danger" @click="wallpaperStore.removeWallpaper">
              移除图片
            </button>
            <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFileChange">
          </div>

          <!-- 已授权的壁纸文件夹：小风车会从这里随机抽图 -->
          <div v-if="settings.folderName || wallpaperStore.folderImages.length" class="folder-state">
            <span class="folder-state__name" :title="settings.folderName">{{ settings.folderName || '壁纸文件夹' }}</span>
            <span class="folder-state__count">{{ wallpaperStore.folderImages.length }} 张</span>
            <button type="button" class="folder-state__clear" @click="clearFolder">
              清除
            </button>
          </div>

          <div v-if="settings.recentImages.length" class="recent-row">
            <span class="recent-label">最近使用</span>
            <button
              v-for="(image, ri) in settings.recentImages" :key="image" type="button" class="recent-image"
              :title="`使用最近的第 ${ri + 1} 张壁纸`" :aria-label="`使用最近的第 ${ri + 1} 张壁纸`"
              @click="selectRecent(image)"
            >
              <img :src="image" alt="最近使用的壁纸">
            </button>
          </div>

          <!-- 壁纸源网站 -->
          <div class="wallpaper-title mt-16">
            壁纸源网站
          </div>
          <div class="source-grid">
            <button
              v-for="item in WALLPAPER_SOURCES"
              :key="item.id"
              type="button"
              class="source-card"
              :class="{ active: settings.imageSource === item.id }"
              :title="item.hint"
              @click="wallpaperStore.update({ imageSource: item.id })"
            >
              {{ item.label }}
            </button>
          </div>
          <div v-if="settings.imageSource === 'custom'" class="advanced-input mt-8">
            <n-input v-model:value="settings.customSource" placeholder="https://example.com/{w}x{h}?r={r}" />
          </div>
          <div class="wallpaper-actions mt-8">
            <button type="button" class="outline-button primary" @click="applyWallpaperSource">
              应用该来源
            </button>
            <span class="source-hint">应用后点页面右下角小风车即可随机换图</span>
          </div>

          <div v-if="imageError" class="wallpaper-error">
            {{ imageError }}
          </div>
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title">
            站点图标
          </div>
          <div class="sliders">
            <label><span>图标圆角</span><input v-model.number="settings.iconRadius" type="range" min="0" max="50"><b>{{ settings.iconRadius }}%</b></label>
            <label><span>图标不透明度</span><input v-model.number="settings.iconOpacity" type="range" min="10" max="100"><b>{{ settings.iconOpacity }}%</b></label>
          </div>
        </section>

        <!--
          自定义布局：仿 inftab 的排版面板。
          行数/列数决定「一页放多少个图标」，间距与图标大小决定疏密，
          全部通过 --layout-* / --wallpaper-icon-size 这几个 CSS 变量实时生效。
        -->
        <section class="wallpaper-section">
          <div class="wallpaper-title">
            自定义布局
            <span class="layout-count">每页 {{ perPageCount }} 个</span>
          </div>
          <div class="sliders">
            <label><span>每页行数</span><input v-model.number="settings.layoutRows" type="range" min="1" max="6" step="1"><b>{{ settings.layoutRows }} 行</b></label>
            <label><span>每页列数</span><input v-model.number="settings.layoutCols" type="range" min="2" max="8" step="1"><b>{{ settings.layoutCols }} 列</b></label>
            <label><span>列间距</span><input v-model.number="settings.layoutColGap" type="range" min="0" max="80" step="1"><b>{{ settings.layoutColGap }}%</b></label>
            <label><span>行间距</span><input v-model.number="settings.layoutRowGap" type="range" min="0" max="80" step="1"><b>{{ settings.layoutRowGap }}%</b></label>
            <label><span>图标大小</span><input v-model.number="settings.iconSize" type="range" min="40" max="140" step="1"><b>{{ settings.iconSize }}%</b></label>
          </div>
          <div
            class="layout-preview" :style="{
              gridTemplateColumns: `repeat(${Math.max(2, Math.round(settings.layoutCols || 5))}, 1fr)`,
              gridTemplateRows: `repeat(${Math.max(1, Math.round(settings.layoutRows || 2))}, 1fr)`,
              columnGap: `calc(var(--wallpaper-icon-size, 64px) * ${Math.round(settings.layoutColGap) / 100})`,
              rowGap: `calc(var(--wallpaper-icon-size, 64px) * ${Math.round(settings.layoutRowGap) / 100})`,
            }"
          >
            <span
              v-for="n in perPageCount" :key="n" class="layout-preview__dot"
              :style="{ width: 'min(100%, calc(var(--wallpaper-icon-size, 64px) * 0.55))' }"
            />
          </div>
          <div class="layout-actions">
            <span class="layout-hint">改动实时生效，翻页用小圆点或鼠标滚轮</span>
            <button type="button" class="outline-button" @click="resetLayout">
              恢复推荐布局
            </button>
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
          <label><span>输入框透明度</span><input v-model.number="settings.inputOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.inputOpacity) }}</b></label>
          <label><span>弹窗透明度</span><input v-model.number="settings.popupOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.popupOpacity) }}</b></label>
          <label class="checkbox-label"><input v-model="settings.autoDim" type="checkbox"><span>自动适配壁纸明暗（深色壁纸自动转浅色文字）</span></label>
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
    </n-drawer-content>
  </n-drawer>
</template>

<style lang="scss" scoped>
.wallpaper-section {
  padding: 16px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--text-c) 14%, transparent);
}
.wallpaper-section:last-child { border-bottom: 0; }
.wallpaper-title { margin-bottom: 10px; font-size: 14px; font-weight: 700; }
.skin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.skin-card, .glass-card, .advanced-tabs button, .recent-image, .source-card {
  border: 1px solid color-mix(in srgb, var(--text-c) 18%, transparent);
  background: color-mix(in srgb, var(--main-bg-c) 70%, transparent);
  color: inherit;
  cursor: pointer;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.skin-card { display: grid; gap: 5px; padding: 5px; border-radius: 8px; font-size: 12px; }
.skin-card:hover, .glass-card:hover, .source-card:hover { transform: translateY(-1px); }
.skin-card.active, .glass-card.active, .advanced-tabs button.active, .source-card.active { border-color: var(--wallpaper-accent, var(--primary-c)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 22%, transparent); }
.skin-preview { height: 36px; border-radius: 5px; }
.accent-controls, .wallpaper-actions, .advanced-input, .wallpaper-footer, .recent-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.accent-controls input[type='color'] { width: 36px; height: 28px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.accent-controls code { opacity: .72; }
.outline-button, .clear-button { padding: 6px 12px; border: 1px solid color-mix(in srgb, var(--text-c) 22%, transparent); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.outline-button:disabled { opacity: .5; cursor: default; }
.outline-button.primary { color: var(--wallpaper-accent, var(--primary-c)); }
.outline-button.danger, .clear-button { color: #d03050; }
.folder-state { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 6px 10px; border-radius: 8px; font-size: 12px; background: color-mix(in srgb, var(--main-bg-c) 60%, transparent); }
.folder-state__name { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.folder-state__count { opacity: .62; }
.folder-state__clear { border: 0; background: transparent; color: #d03050; font-size: 12px; cursor: pointer; }
.recent-row { margin-top: 12px; }
.recent-label { width: 100%; font-size: 12px; opacity: .62; }
.recent-image { width: 56px; height: 40px; padding: 0; overflow: hidden; border-radius: 5px; }
.recent-image img { width: 100%; height: 100%; object-fit: cover; }
.wallpaper-error { margin-top: 8px; color: #d03050; font-size: 12px; }
.source-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.source-card { padding: 8px 10px; border-radius: 8px; font-size: 12px; text-align: left; }
.source-hint { font-size: 12px; opacity: .62; }
.glass-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.glass-card { display: grid; gap: 5px; padding: 10px; text-align: left; border-radius: 8px; }
.glass-card small { opacity: .62; }
.glass-demo { height: 42px; border-radius: 6px; background: linear-gradient(110deg, #ff5364, #ffb347 35%, #36d1dc); border: 4px solid rgba(255, 255, 255, .65); }
.liquid-demo { box-shadow: inset 0 0 20px rgba(255,255,255,.35), 0 4px 12px rgba(20, 100, 180, .15); }
.sliders { display: grid; gap: 11px; }
.sliders label { display: grid; grid-template-columns: 100px 1fr 46px; align-items: center; gap: 10px; font-size: 12px; }
.sliders input[type='range'] { width: 100%; accent-color: var(--wallpaper-accent, var(--primary-c)); }
.sliders b { text-align: right; font-weight: 400; opacity: .72; }
.sliders .checkbox-label { display: flex; grid-template-columns: unset; justify-content: flex-start; }
.advanced-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
.advanced-tabs button { padding: 5px 10px; border-radius: 6px; }
.advanced-input { align-items: stretch; flex-wrap: nowrap; }
.advanced-input :deep(.n-input) { flex: 1; }
.clear-button { width: 100%; margin-top: 12px; }
.wallpaper-footer { justify-content: flex-end; }
.wallpaper-footer span { margin-right: auto; font-size: 12px; opacity: .62; }
/* ---- 自定义布局 ---- */
.layout-count { float: right; font-weight: 400; font-size: 12px; opacity: .62; }
.layout-preview {
  display: grid;
  justify-items: center;
  align-items: center;
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--main-bg-c) 55%, transparent);
}
.layout-preview__dot {
  aspect-ratio: 1;
  max-width: 100%;
  border-radius: 50%;
  background: color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 55%, transparent);
}
.layout-actions { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.layout-hint { flex: 1; font-size: 12px; opacity: .62; }
.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
</style>
