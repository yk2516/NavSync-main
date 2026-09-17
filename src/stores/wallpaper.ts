import type { WallpaperSettings } from '@/types'

const STORAGE_KEY_ADMIN = 'wallpaper_admin'
const STORAGE_KEY_VIEWER = 'wallpaper_viewer'

const SKINS: Record<string, { label: string; background: string }> = {
  default: { label: '默认', background: 'var(--bg-c)' },
  deepBlue: { label: '沉静蓝', background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)' },
  polarGreen: { label: '极光青', background: 'linear-gradient(135deg, #0f2a2e 0%, #173b3b 100%)' },
  starPurple: { label: '星云紫', background: 'linear-gradient(135deg, #211a34 0%, #3b285f 100%)' },
  warmBrown: { label: '余烬棕', background: 'linear-gradient(135deg, #2c2019 0%, #4b2f1f 100%)' },
  midnight: { label: '午夜黑', background: 'linear-gradient(135deg, #090b12 0%, #202333 100%)' },
  ios: { label: 'iOS 屏半', background: 'linear-gradient(90deg, #f8fafc 0 50%, #17191f 50%)' },
  clear: { label: '干净明亮', background: 'linear-gradient(135deg, #ffffff 0%, #e8eef7 100%)' },
  material: { label: 'Material 粉', background: 'linear-gradient(135deg, #f8e9ee 0%, #ffffff 100%)' },
}

const DEFAULTS: WallpaperSettings = {
  skin: 'default',
  accent: '#0071e3',
  source: 'none',
  image: '',
  imageUrl: '',
  gradient: '',
  recentImages: [],
  glass: 'classic',
  wallpaperOpacity: 48,
  wallpaperBlur: 0,
  sidebarOpacity: 72,
  inputOpacity: 60,
  popupOpacity: 40,
  autoDim: true,
}

function storageKey(isAdmin: boolean) {
  return isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_VIEWER
}

function loadSettings(isAdmin: boolean): WallpaperSettings {
  try {
    const raw = localStorage.getItem(storageKey(isAdmin))
    if (!raw)
      return { ...DEFAULTS, recentImages: [] }
    const parsed = JSON.parse(raw) as Partial<WallpaperSettings>
    return {
      ...DEFAULTS,
      ...parsed,
      recentImages: Array.isArray(parsed.recentImages) ? parsed.recentImages.slice(0, 6) : [],
    }
  }
  catch {
    return { ...DEFAULTS, recentImages: [] }
  }
}

function safeUrl(url: string) {
  return url.replace(/"/g, '\\"').replace(/\n/g, '')
}

export const wallpaperSkins = SKINS

export const useWallpaperStore = defineStore('wallpaper', () => {
  const adminStore = useAdminStore()
  const settings = ref<WallpaperSettings>(loadSettings(adminStore.isAdmin))
  const panelVisible = ref(false)
  let skipPersist = false

  const isAdmin = computed(() => adminStore.isAdmin)

  function persist() {
    if (skipPersist)
      return
    try {
      localStorage.setItem(storageKey(isAdmin.value), JSON.stringify(settings.value))
    }
    catch {
      // 图片超出 localStorage 配额时保留当前会话的壁纸，不阻断页面
    }
  }

  function apply() {
    if (typeof document === 'undefined')
      return

    const root = document.documentElement
    const body = document.body
    const current = settings.value
    const skin = SKINS[current.skin] || SKINS.default
    let image = ''
    if (current.source === 'local' && current.image)
      image = current.image
    else if (current.source === 'url' && current.imageUrl)
      image = current.imageUrl

    root.style.setProperty('--wallpaper-skin', skin.background)
    root.style.setProperty('--wallpaper-accent', current.accent || '#0071e3')
    root.style.setProperty('--wallpaper-opacity', String(Math.max(0, Math.min(100, current.wallpaperOpacity)) / 100))
    root.style.setProperty('--wallpaper-blur', `${Math.max(0, Math.min(32, current.wallpaperBlur))}px`)
    root.style.setProperty('--wallpaper-sidebar-opacity', String(Math.max(0, Math.min(100, current.sidebarOpacity)) / 100))
    root.style.setProperty('--wallpaper-input-opacity', String(Math.max(0, Math.min(100, current.inputOpacity)) / 100))
    root.style.setProperty('--wallpaper-popup-opacity', String(Math.max(0, Math.min(100, current.popupOpacity)) / 100))
    root.style.setProperty('--wallpaper-image', image ? `url("${safeUrl(image)}")` : 'none')
    root.style.setProperty('--wallpaper-gradient', current.gradient || 'none')
    root.dataset.wallpaperGlass = current.glass
    root.dataset.wallpaperSource = current.source
    root.dataset.wallpaperAutoDim = current.autoDim ? 'true' : 'false'
    body.style.setProperty('--primary-c', current.accent || '')
  }

  function update(patch: Partial<WallpaperSettings>) {
    Object.assign(settings.value, patch)
    persist()
    apply()
  }

  function setSkin(skin: string) {
    update({ skin, source: 'none', image: '', imageUrl: '', gradient: '' })
  }

  function setImage(image: string, source: 'local' | 'url' = 'local') {
    update({ source, image: source === 'local' ? image : '', imageUrl: source === 'url' ? image : '', gradient: '' })
    if (image && source === 'local') {
      const recentImages = [image, ...settings.value.recentImages.filter(item => item !== image)].slice(0, 6)
      update({ recentImages })
    }
  }

  function setGradient(gradient: string) {
    update({ source: 'gradient', gradient, image: '', imageUrl: '' })
  }

  function removeWallpaper() {
    update({ source: 'none', image: '', imageUrl: '', gradient: '' })
  }

  function reset() {
    settings.value = { ...DEFAULTS, recentImages: [] }
    persist()
    apply()
  }

  function openPanel() {
    panelVisible.value = true
  }

  function closePanel() {
    panelVisible.value = false
  }

  watch(isAdmin, (value) => {
    skipPersist = true
    settings.value = loadSettings(value)
    nextTick(() => {
      skipPersist = false
      apply()
    })
  })

  watch(settings, () => {
    persist()
    apply()
  }, { deep: true })

  apply()

  return {
    settings,
    panelVisible,
    isAdmin,
    update,
    // 供 App.vue 在启动时把壁纸变量注入 DOM；此前遗漏导出会导致 setup 抛错、整页白屏
    apply,
    setSkin,
    setImage,
    setGradient,
    removeWallpaper,
    reset,
    openPanel,
    closePanel,
  }
})
