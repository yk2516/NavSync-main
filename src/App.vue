<script setup>
import { RouterView } from 'vue-router'
import { bootstrapViewer } from '@/composables/bootstrap'

// 站长复验 + 访客只读配置拉取（不阻塞首屏渲染）
bootstrapViewer()
</script>

<template>
  <AppProvider>
    <AppContainer>
      <RouterView />
    </AppContainer>
  </AppProvider>
</template>
