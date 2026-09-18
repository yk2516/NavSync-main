<script setup lang="ts">

</script>

<template>
  <!--
    宽度：92%，最宽 1240px。
    原实现用 lg 前缀把宽度写死成 1240px，而 width:100% 只在 max-width:640px 下生效，
    于是视口在 1024~1239px 之间时容器恒为 1240px，比视口还宽 → 必现横向滚动条、内容被推得偏右。
    改成 max-w 上限后，宽屏仍是 1240px，窄桌面端自动收缩。

    注意：注释里不要出现 attributify 形式的 utility 字面量（如 lg 属性配 w-1240），
    presetAttributify 是按文本扫描的，会把注释里的写法当成真实用法生成 CSS。
  -->
  <div mx-auto max-w-1240 w-92p class="mobile-container">
    <slot />
  </div>
</template>
