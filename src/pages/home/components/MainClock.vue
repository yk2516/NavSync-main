<script setup lang="ts">
import dayjs from 'dayjs'
import { getFestival, solarToLunar } from '@/utils/lunar'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const time = ref('')
const weekday = ref('')
const solarText = ref('')
const lunarText = ref('')
const extraText = ref('')

let timeInterval: ReturnType<typeof setInterval> | undefined

function refreshTime() {
  const now = new Date()
  time.value = dayjs(now).format('HH:mm')

  // 日期部分只在跨天时变化，但计算量很小，跟着秒级刷新即可
  weekday.value = WEEKDAYS[now.getDay()]
  solarText.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`

  const lunar = solarToLunar(now)
  lunarText.value = lunar?.text || ''
  extraText.value = getFestival(now, lunar)
}

function timing() {
  // 先清理旧定时器，防止组件重新挂载时多个 interval 并行
  if (timeInterval)
    clearInterval(timeInterval)
  refreshTime()
  const nowMinute = time.value
  timeInterval = setInterval(() => {
    refreshTime()
    if (nowMinute !== time.value) {
      clearInterval(timeInterval)
      timeInterval = setInterval(refreshTime, 60000)
    }
  }, 1000)
}

onMounted(() => {
  timing()
})

onBeforeUnmount(() => {
  if (timeInterval)
    clearInterval(timeInterval)
})
</script>

<template>
  <div class="clock">
    <div class="clock__time">
      {{ time }}
    </div>
    <!-- 公历 + 农历：仿极光Tab，一眼看到星期、日期与农历 -->
    <div class="clock__meta">
      <span>{{ weekday }}</span>
      <span class="clock__dot">·</span>
      <span>{{ solarText }}</span>
      <template v-if="lunarText">
        <span class="clock__dot">·</span>
        <span class="clock__lunar">{{ lunarText }}</span>
      </template>
      <template v-if="extraText">
        <span class="clock__tag">{{ extraText }}</span>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.clock {
  text-align: center;
}

.clock__time {
  font-size: 48px;
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: 1px;
}

.clock__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-c);
  opacity: .88;
}

.clock__dot {
  opacity: .45;
}

.clock__lunar {
  color: var(--wallpaper-accent, var(--primary-c));
  font-weight: 600;
}

.clock__tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #fff;
  background-color: var(--wallpaper-accent, var(--primary-c));
}

@media screen and (max-width: 640px) {
  .clock__time {
    font-size: 38px;
  }

  .clock__meta {
    font-size: 12px;
    gap: 4px;
  }
}
</style>
