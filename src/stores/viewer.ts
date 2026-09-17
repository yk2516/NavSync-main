import { isAdminStored, loadViewerCache } from '@/utils/publicConfig'

/**
 * 访客首屏就绪状态
 *
 * 访客首次访问时本地还没有站长云端配置的缓存，若直接渲染会先闪出内置的初始预设页面。
 * 这里用 ready 标记把导航区压住，等云端配置到位（或明确失败）再渲染。
 * 站长本机有完整本地配置，无需等待。
 */
export const useViewerStore = defineStore('viewer', () => {
  const ready = ref(isAdminStored() || !!loadViewerCache())
  const failed = ref(false)
  const errorMsg = ref('')

  function markReady() {
    ready.value = true
  }

  function markFailed(message = '') {
    failed.value = true
    errorMsg.value = message
    ready.value = true
  }

  return {
    ready,
    failed,
    errorMsg,
    markReady,
    markFailed,
  }
})
