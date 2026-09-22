<script setup lang="ts">
import { WALLPAPER_GRADIENTS, wallpaperSkins } from '@/stores/wallpaper'

const wallpaperStore = useWallpaperStore()
// 「本地图片」页签已移除（用户明确要求），只剩渐变与图片链接两个来源。
// 渐变排第一并作为默认页签 —— 纯 CSS、零请求，是导航页最合适的壁纸形态。
const activeSource = ref<'url' | 'gradient'>('gradient')
const imageUrlInput = ref('')
const gradientInput = ref('linear-gradient(135deg, #ff5364 0%, #ffb347 34%, #36d1dc 100%)')
const imageError = ref('')

const settings = computed(() => wallpaperStore.settings)

/**
 * 皮肤按 group 分组展示（基础 / 清新 / 明亮 / 深色 / 品牌）。
 * 分组顺序 = SKINS 里的键序，所以新增皮肤时把条目放到对应分组的末尾即可。
 */
const skinGroups = computed(() => {
  const groups: Record<string, { key: string; label: string; background: string }[]> = {}
  for (const [key, skin] of Object.entries(wallpaperSkins))
    (groups[skin.group] ||= []).push({ key, label: skin.label, background: skin.background })
  return groups
})

const skinCount = computed(() => Object.keys(wallpaperSkins).length)

/** 渐变预设同样按 group 分组（清新柔和 / 强对比），顺序 = WALLPAPER_GRADIENTS 的数组序 */
const gradientGroups = computed(() => {
  const groups: Record<string, { label: string; value: string }[]> = {}
  for (const item of WALLPAPER_GRADIENTS)
    (groups[item.group] ||= []).push({ label: item.label, value: item.value })
  return groups
})

/**
 * 折叠状态（三级：分区 / 皮肤分组 / 渐变分组）。
 *
 * 默认值按「打开面板第一眼看到什么」定：
 * - **分区默认展开** —— 皮肤、图标、搜索框、布局都是常调项，收起来反而要多点一次；
 *   折叠是给「这次只想调某一项」的场景用的，不是默认态。
 * - **皮肤分组只展开第一组（基础）** —— 48 套铺开要滚 3 屏，而绝大多数人只用默认那几套。
 * - **渐变分组全部收起** —— 它们本来就藏在「高级壁纸」的渐变页签里，是二级入口。
 *
 * 记录的是**收起**的键（不是展开）：默认值只需写「哪些默认收起」，
 * 新增分组时不会因为忘记加默认项而被误收起来。
 *
 * 状态只放内存、不落 localStorage：面板是懒挂载且挂载后不卸载，一次会话内保持；
 * 下次打开回到精简默认态，比「记住上次」更好用，也省掉一个新存储键。
 */
const closedSections = ref<Record<string, boolean>>({})
const closedSkinGroups = ref<Record<string, boolean>>(
  Object.fromEntries(Object.keys(skinGroups.value).slice(1).map(name => [name, true])),
)
const closedGradientGroups = ref<Record<string, boolean>>(
  Object.fromEntries(Object.keys(gradientGroups.value).map(name => [name, true])),
)

function toggleSection(id: string) {
  closedSections.value[id] = !closedSections.value[id]
}

function toggleSkinGroup(name: string) {
  closedSkinGroups.value[name] = !closedSkinGroups.value[name]
}

function toggleGradientGroup(name: string) {
  closedGradientGroups.value[name] = !closedGradientGroups.value[name]
}

/**
 * n-drawer（naive-ui 2.34）自身没有 Esc 关闭逻辑 —— 源码里搜不到 Escape，
 * 而抽屉带 role="dialog" aria-modal="true"，键盘用户不该只能一路 Tab 去找右上角的 ×。
 * 这里自己挂一个全局 Esc 监听，只在面板打开时生效。
 *
 * 监听在挂载时就装上、由回调自己判断开没开，**不要**改成 `watch(panelVisible)` 里注册：
 * 本组件现在是「第一次打开才挂载」（`useLazyMount`），挂载那一刻 `panelVisible` 已经是 true，
 * 非 immediate 的 watch 因为「值没有发生变化」永远不会触发，监听就永远装不上 ——
 * 表现是首次打开后按 Esc 关不掉（第二次打开反而正常，因为那时值会真的变化）。
 */
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !wallpaperStore.panelVisible)
    return
  e.stopPropagation()
  wallpaperStore.closePanel()
}

onMounted(() => window.addEventListener('keydown', onPanelKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onPanelKeydown))

function applyUrl() {
  const value = imageUrlInput.value.trim()
  if (!/^https?:\/\//i.test(value)) {
    imageError.value = '图片链接必须以 http:// 或 https:// 开头'
    return
  }
  imageError.value = ''
  wallpaperStore.setImageUrl(value)
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

/** 点渐变预设 = 填进输入框 + 立即应用（输入框同步更新，用户可继续手改） */
function useGradientPreset(value: string) {
  gradientInput.value = value
  applyGradient()
}

function randomAccent() {
  const colors = ['#0071e3', '#4f7ff0', '#25c89f', '#24c5d7', '#9e83ee', '#ff9138', '#ef6d6d', '#f6b91e', '#db72e8', '#df68ac', '#35c4b4', '#98dc36']
  wallpaperStore.update({ accent: colors[Math.floor(Math.random() * colors.length)] })
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

/** 一键回到「2 行 × 5 列 + 正圆大图标」的推荐外观 */
function resetLayout() {
  wallpaperStore.update({
    layoutRows: 2,
    layoutCols: 5,
    layoutColGap: 30,
    layoutRowGap: 30,
    iconRadius: 50,
    iconSize: 112,
  })
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
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.skin"
              aria-controls="wp-body-skin"
              @click="toggleSection('skin')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>皮肤</span>
            </button>
            <span class="panel-hint">{{ skinCount }} 套 · 纯 CSS，切换即时</span>
          </div>
          <div v-show="!closedSections.skin" id="wp-body-skin" class="wallpaper-body">
            <div v-for="(list, group) in skinGroups" :key="group" class="skin-group">
              <!-- 分组标题也是折叠头：48 套皮肤一次全铺开要滚三屏。
                   计数放在按钮**外面** —— `.skin-group__title` 的纯文本被验收套件当作分组名比对，
                   往里塞「16 套」会让 `groups == ['基础','清新',...]` 直接翻红。 -->
              <div class="skin-group__head">
                <button
                  class="skin-group__title"
                  type="button"
                  :aria-expanded="!closedSkinGroups[group]"
                  @click="toggleSkinGroup(group)"
                >
                  <span class="section-toggle__caret" aria-hidden="true" />
                  <span>{{ group }}</span>
                </button>
                <span class="skin-group__meta">{{ list.length }} 套</span>
              </div>
              <div v-show="!closedSkinGroups[group]" class="skin-grid">
                <button
                  v-for="skin in list"
                  :key="skin.key"
                  class="skin-card"
                  :class="{ active: settings.skin === skin.key && settings.source === 'none' }"
                  type="button"
                  :title="`使用「${skin.label}」皮肤`"
                  @click="wallpaperStore.setSkin(skin.key)"
                >
                  <span class="skin-preview" :style="{ background: skin.background }" />
                  <span>{{ skin.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.accent"
              aria-controls="wp-body-accent"
              @click="toggleSection('accent')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>强调色（Accent）</span>
            </button>
          </div>
          <div v-show="!closedSections.accent" id="wp-body-accent" class="wallpaper-body">
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
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.icon"
              aria-controls="wp-body-icon"
              @click="toggleSection('icon')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>站点图标</span>
            </button>
            <span class="panel-hint">形状 / 大小 / 留白</span>
          </div>
          <div v-show="!closedSections.icon" id="wp-body-icon" class="wallpaper-body">
            <!--
              一键形状：直接写 iconRadius（圆形 = 50%，正圆）。
              ⚠️ 这里**不能**复用 `.advanced-tabs` 类 —— 那是「高级壁纸」来源页签的专属标记，
              套件按 `.advanced-tabs button` 取页签列表，混进这三个按钮会把「只剩渐变/图片链接」
              的断言顶红。形状行用自己的 `.icon-shape-row`。
            -->
            <div class="icon-shape-row">
              <button type="button" :class="{ active: settings.iconRadius >= 48 }" @click="wallpaperStore.update({ iconRadius: 50 })">
                圆形
              </button>
              <button type="button" :class="{ active: settings.iconRadius > 8 && settings.iconRadius < 48 }" @click="wallpaperStore.update({ iconRadius: 26 })">
                圆角方形
              </button>
              <button type="button" :class="{ active: settings.iconRadius <= 8 }" @click="wallpaperStore.update({ iconRadius: 0 })">
                方形
              </button>
            </div>
            <div class="sliders">
              <label><span>图标大小</span><input v-model.number="settings.iconSize" type="range" min="40" max="140" step="1"><b>{{ settings.iconSize }}%</b></label>
              <label><span>图标圆角</span><input v-model.number="settings.iconRadius" type="range" min="0" max="50"><b>{{ settings.iconRadius }}%</b></label>
              <label><span>图标内边距</span><input v-model.number="settings.iconPadding" type="range" min="0" max="30" step="1"><b>{{ settings.iconPadding }}%</b></label>
              <label><span>图标不透明度</span><input v-model.number="settings.iconOpacity" type="range" min="10" max="100"><b>{{ settings.iconOpacity }}%</b></label>
            </div>
          </div>
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.search"
              aria-controls="wp-body-search"
              @click="toggleSection('search')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>搜索框</span>
            </button>
          </div>
          <div v-show="!closedSections.search" id="wp-body-search" class="wallpaper-body">
            <div class="sliders">
              <label><span>搜索框宽度</span><input v-model.number="settings.searchWidth" type="range" min="260" max="900" step="10"><b>{{ settings.searchWidth }}px</b></label>
              <label><span>搜索框圆角</span><input v-model.number="settings.searchRadius" type="range" min="0" max="28" step="1"><b>{{ settings.searchRadius }}px</b></label>
              <label><span>搜索框透明度</span><input v-model.number="settings.inputOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.inputOpacity) }}</b></label>
            </div>
          </div>
        </section>

        <!--
          自定义布局：仿 inftab 的排版面板。
          行数/列数决定「一页放多少个图标」，间距与图标大小决定疏密，
          全部通过 --layout-* / --wallpaper-icon-size 这几个 CSS 变量实时生效。
        -->
        <section class="wallpaper-section">
          <div class="wallpaper-title">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.layout"
              aria-controls="wp-body-layout"
              @click="toggleSection('layout')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>自定义布局</span>
            </button>
            <span class="layout-count">每页 {{ perPageCount }} 个</span>
          </div>
          <div v-show="!closedSections.layout" id="wp-body-layout" class="wallpaper-body">
            <div class="sliders">
              <label><span>每页行数</span><input v-model.number="settings.layoutRows" type="range" min="1" max="6" step="1"><b>{{ settings.layoutRows }} 行</b></label>
              <label><span>每页列数</span><input v-model.number="settings.layoutCols" type="range" min="2" max="8" step="1"><b>{{ settings.layoutCols }} 列</b></label>
              <label><span>列间距</span><input v-model.number="settings.layoutColGap" type="range" min="0" max="80" step="1"><b>{{ settings.layoutColGap }}%</b></label>
              <label><span>行间距</span><input v-model.number="settings.layoutRowGap" type="range" min="0" max="80" step="1"><b>{{ settings.layoutRowGap }}%</b></label>
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
          </div>
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.glass"
              aria-controls="wp-body-glass"
              @click="toggleSection('glass')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>玻璃效果</span>
            </button>
          </div>
          <div v-show="!closedSections.glass" id="wp-body-glass" class="wallpaper-body">
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
          </div>
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.effect"
              aria-controls="wp-body-effect"
              @click="toggleSection('effect')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>壁纸效果</span>
            </button>
          </div>
          <div v-show="!closedSections.effect" id="wp-body-effect" class="wallpaper-body sliders">
            <label><span>壁纸透明度</span><input v-model.number="settings.wallpaperOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.wallpaperOpacity) }}</b></label>
            <label><span>壁纸模糊</span><input v-model.number="settings.wallpaperBlur" type="range" min="0" max="32"><b>{{ settings.wallpaperBlur }}px</b></label>
            <label><span>弹窗透明度</span><input v-model.number="settings.popupOpacity" type="range" min="0" max="100"><b>{{ formatPercent(settings.popupOpacity) }}</b></label>
            <label class="checkbox-label"><input v-model="settings.autoDim" type="checkbox"><span>自动适配壁纸明暗（深色壁纸自动转浅色文字）</span></label>
          </div>
        </section>

        <section class="wallpaper-section">
          <div class="wallpaper-title advanced-title">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="!closedSections.advanced"
              aria-controls="wp-body-advanced"
              @click="toggleSection('advanced')"
            >
              <span class="section-toggle__caret" aria-hidden="true" />
              <span>高级壁纸（URL / 渐变）</span>
            </button>
            <!-- ⚠️ 这个 select 必须留在标题行、**不能**塞进折叠头按钮里：
                 ① `<button>` 内嵌交互元素（select）是非法 HTML；
                 ② 验收套件按 `.wallpaper-title.advanced-title` 的文本断言「图标源」存在，
                    并直接等 `.favicon-source-control select` 可见 —— 放进折叠体里会被收起挡掉。 -->
            <label class="favicon-source-control">
              <span>图标源</span>
              <select v-model="settings.faviconSource" aria-label="选择站点图标源">
                <option value="site">网站 favicon.ico</option>
                <option value="google">Google Favicon Service</option>
                <option value="duckduckgo">DuckDuckGo Icons</option>
                <option value="solid">纯色图标（本地合成）</option>
              </select>
            </label>
          </div>
          <div v-show="!closedSections.advanced" id="wp-body-advanced" class="wallpaper-body">
            <div class="advanced-tabs">
              <button type="button" :class="{ active: activeSource === 'gradient' }" @click="activeSource = 'gradient'">
                渐变
              </button>
              <button type="button" :class="{ active: activeSource === 'url' }" @click="activeSource = 'url'">
                图片链接
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
            <!-- 校验提示必须真的渲染出来：之前 imageError 只赋值不显示，格式填错时界面毫无反应 -->
            <div v-if="imageError" class="wallpaper-error" role="alert">
              {{ imageError }}
            </div>
            <!-- 现成配色，点一下直接应用；也可以点完再改输入框里的色值 -->
            <div v-if="activeSource === 'gradient'" class="gradient-groups">
              <div v-for="(list, group) in gradientGroups" :key="group" class="preset-group">
                <!-- 分组同样可折叠；计数在按钮外，保持 `.preset-group__title` 的纯文本是分组名 -->
                <div class="preset-group__head">
                  <button
                    class="preset-group__title"
                    type="button"
                    :aria-expanded="!closedGradientGroups[group]"
                    @click="toggleGradientGroup(group)"
                  >
                    <span class="section-toggle__caret" aria-hidden="true" />
                    <span>{{ group }}</span>
                  </button>
                  <span class="preset-group__meta">{{ list.length }} 个</span>
                </div>
                <div v-show="!closedGradientGroups[group]" class="gradient-presets">
                  <button
                    v-for="item in list"
                    :key="item.label"
                    type="button"
                    class="gradient-preset"
                    :class="{ active: settings.source === 'gradient' && settings.gradient === item.value }"
                    :title="item.value"
                    :aria-label="`使用「${item.label}」渐变`"
                    @click="useGradientPreset(item.value)"
                  >
                    <span class="gradient-preset__preview" :style="{ background: item.value }" />
                    <span>{{ item.label }}</span>
                  </button>
                </div>
              </div>
            </div>
            <button type="button" class="clear-button" @click="wallpaperStore.removeWallpaper">
              清除壁纸
            </button>
          </div>
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
.wallpaper-title { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 14px; font-weight: 700; }
/* 「高级壁纸」标题行右侧还挂着「图标源」下拉，用 space-between 把它推到最右 */
.advanced-title { justify-content: space-between; }

/* ---- 折叠头 ----
 * 用 <button> 而不是可点 <div>：键盘 Tab 能聚焦、Enter/Space 能触发，不用手写 keydown。
 * 代价是要把浏览器默认样式清干净，否则按钮的字号/颜色会顶掉标题自己的样式。 */
.section-toggle,
.skin-group__title,
.preset-group__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.section-toggle:hover { opacity: .74; }

/* 展开 / 收起箭头。
 *
 * ⚠️ **必须用 CSS 边框画三角，不能用 ▾ / ▶ 这类文字字符**：验收套件把
 * `.wallpaper-title` / `.skin-group__title` / `.preset-group__title` 的 textContent
 * 当作纯文本比对（分组名是严格相等），多一个字符就整条断言翻红。
 * 用 `currentColor` 让箭头跟随标题文字色，深色壁纸下自动变浅。 */
.section-toggle__caret {
  flex: 0 0 auto;
  width: 0;
  height: 0;
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  opacity: .5;
  transform: rotate(90deg);
  transition: transform .18s ease;
}
[aria-expanded='false'] > .section-toggle__caret { transform: rotate(0deg); }
.favicon-source-control { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 400; white-space: nowrap; }
.favicon-source-control span { opacity: .62; }
.favicon-source-control select {
  max-width: 188px;
  padding: 4px 6px;
  border: 1px solid color-mix(in srgb, var(--text-c) 22%, transparent);
  border-radius: 6px;
  background: var(--main-bg-c);
  color: inherit;
  font: inherit;
}
.skin-group + .skin-group { margin-top: 12px; }
/* 分组标题行：折叠头在左、套数在右。计数**不能**塞进按钮里（见模板注释）。 */
.skin-group__head,
.preset-group__head { display: flex; align-items: center; gap: 8px; }
.skin-group__head { margin-bottom: 6px; }
.preset-group__head { margin: 10px 0 6px; }
.skin-group__title,
.preset-group__title { font-size: 12px; font-weight: 400; opacity: .62; }
.skin-group__title:hover,
.preset-group__title:hover { opacity: .95; }
.skin-group__meta,
.preset-group__meta { margin-left: auto; font-size: 11px; opacity: .5; }
.skin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.skin-card, .glass-card, .advanced-tabs button, .icon-shape-row button, .gradient-preset {
  border: 1px solid color-mix(in srgb, var(--text-c) 18%, transparent);
  background: color-mix(in srgb, var(--main-bg-c) 70%, transparent);
  color: inherit;
  cursor: pointer;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.skin-card, .gradient-preset { display: grid; gap: 4px; padding: 4px; border-radius: 8px; font-size: 12px; line-height: 1.25; }
.skin-card:hover, .glass-card:hover, .gradient-preset:hover { transform: translateY(-1px); }
.skin-card.active, .glass-card.active, .advanced-tabs button.active, .icon-shape-row button.active, .gradient-preset.active { border-color: var(--wallpaper-accent, var(--primary-c)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--wallpaper-accent, var(--primary-c)) 22%, transparent); }
/* 皮肤有 40+ 套，预览条压到 30px 才不至于把面板拉太长 */
.skin-preview { height: 30px; border-radius: 5px; }
/* 渐变预设：3 列，点一下直接应用。分「清新柔和 / 强对比」两组展示，两组都可折叠 */
.preset-group + .preset-group { margin-top: 12px; }
.gradient-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.gradient-preset__preview { height: 26px; border-radius: 5px; }
.accent-controls, .advanced-input, .wallpaper-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.accent-controls input[type='color'] { width: 36px; height: 28px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.accent-controls code { opacity: .72; }
.outline-button, .clear-button { padding: 6px 12px; border: 1px solid color-mix(in srgb, var(--text-c) 22%, transparent); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.outline-button:disabled { opacity: .5; cursor: default; }
.outline-button.primary { color: var(--wallpaper-accent, var(--primary-c)); }
.outline-button.danger, .clear-button { color: #d03050; }
/* 高级壁纸的校验提示（URL / 渐变格式填错时） */
.wallpaper-error { margin-top: 8px; color: #d03050; font-size: 12px; }
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
.advanced-tabs, .icon-shape-row { display: flex; gap: 8px; margin-bottom: 10px; }
.advanced-tabs button, .icon-shape-row button { padding: 5px 10px; border-radius: 6px; }
/* 图标形状：三个等宽按钮 */
.icon-shape-row button { flex: 1; }
.advanced-input { align-items: stretch; flex-wrap: nowrap; }
.advanced-input :deep(.n-input) { flex: 1; }
.clear-button { width: 100%; margin-top: 12px; }
.wallpaper-footer { justify-content: flex-end; }
.wallpaper-footer span { margin-right: auto; font-size: 12px; opacity: .62; }
/* ---- 自定义布局 ---- */
/* 标题右侧的说明文字都靠 `margin-left: auto` 推到最右（标题行已是 flex，
 * 原来的 `float: right` 在 flex 容器里不生效）。
 * 不要复用 .layout-count —— 那个类名是「每页 N 个」的专属标记，
 * 测试与别处都按它取值，多挂一个会让 querySelector 取错元素。 */
.layout-count { margin-left: auto; font-weight: 400; font-size: 12px; opacity: .62; }
.panel-hint { margin-left: auto; font-weight: 400; font-size: 12px; opacity: .62; }
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
</style>
