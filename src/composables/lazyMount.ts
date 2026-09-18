import type { Ref } from 'vue'

/**
 * 「首屏不加载、用到才加载」的辅助
 *
 * 背景：首页曾经把 `/setting` 的整套 UI（SettingSelection / CloudSync / AdminGate …）、
 * 编辑态拖拽（SiteGroupList + vuedraggable，约 37KB）、壁纸面板、站点弹窗**全部静态导入**。
 * ES 静态导入的语义是「必须先全部下载并执行完，导入方才能开始执行」——
 * 于是首页首屏要等 48 个资源全部到位才能渲染，其中一大半是访客永远不会用到的。
 *
 * 这里提供两个能力：
 *   - `prefetchOnIdle`：首屏渲染完成后、浏览器空闲时再把 chunk 拉下来。
 *     不占关键路径，但用户点开时已经就绪（不牺牲交互手感）。
 *   - `useLazyMount`：给 `n-modal` / `n-drawer` 这类「必须挂着才能播进出动画」的组件用。
 *     它们不能简单地用 `v-if` 换成动态导入（那样组件一挂载就立刻去加载了），
 *     所以改成「第一次需要显示时才真正挂载」，之后保持挂载。
 */

/** 浏览器空闲时执行；不支持 requestIdleCallback 就退化成延时 */
function whenIdle(fn: () => void, timeout = 2500) {
  if (typeof requestIdleCallback === 'function')
    requestIdleCallback(() => fn(), { timeout })
  else
    setTimeout(fn, timeout)
}

/**
 * 首屏渲染完成后空闲时预取若干 chunk
 *
 * 只应在 `onMounted` 里调用 —— 太早会和首屏资源抢带宽，就失去意义了。
 * 预取失败无所谓（离线、被拦截），所以逐个吞掉异常。
 */
export function prefetchOnIdle(...loaders: Array<() => Promise<unknown>>) {
  whenIdle(() => loaders.forEach(load => load().catch(() => {})))
}

/**
 * 「第一次变为可见时挂载，之后一直挂着」
 *
 * @param isVisible 该组件对应的显示状态（如 `modalStore.modalVisible`）
 * @returns 是否应该渲染该组件
 */
export function useLazyMount(isVisible: () => boolean): Ref<boolean> {
  const mounted = ref(false)
  watch(
    isVisible,
    (visible) => {
      if (visible)
        mounted.value = true
    },
    { immediate: true },
  )
  return mounted
}
