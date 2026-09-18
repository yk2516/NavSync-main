<script setup lang="ts">

</script>

<template>
  <!--
    宽度：92%，最宽 1240px。
    原来写的是 lg="w-1240"（≥1024px 固定 1240px），而 width:100% 只在 max-width:640px 下生效，
    于是视口在 1024~1239px 之间时容器恒为 1240px，比视口还宽 → 必现横向滚动条、内容被推得偏右。
    改成 max-w 上限后，宽屏仍是 1240px，窄桌面端自动收缩。
  -->
  <div mx-auto w-92p max-w-1240 class="mobile-container">
    <slot />
  </div>
</template>
