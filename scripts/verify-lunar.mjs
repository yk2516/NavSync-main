/**
 * 校验 src/utils/lunar.ts 的农历换算是否与权威实现一致。
 *
 * 背景：页面只需要「公历 → 农历几月几日」这一件事，引入 lunar-javascript
 * 会让时钟 chunk 从 11KB 涨到 300KB（gzip +100KB），所以改成内置压缩表。
 * 正确性靠这个脚本保证：把 src/utils/lunar.ts 编译成 JS，对 1900-01-31 ~
 * 2100-12-31 共 73384 天逐日与 lunar-javascript 比对。
 *
 * 用法（项目根目录）：
 *   node scripts/verify-lunar.mjs
 *
 * 改了 src/utils/lunar.ts 里的表或算法后，务必重跑一次。
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'
import { Solar } from 'lunar-javascript'

mkdirSync('.temp', { recursive: true })
const out = resolve('.temp/lunar.built.mjs')
buildSync({
  entryPoints: ['src/utils/lunar.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'warning',
})

const { solarToLunar } = await import(pathToFileURL(out).href)

const START = Date.UTC(1900, 0, 31)
const END = Date.UTC(2100, 11, 31)

let checked = 0
let bad = 0
const samples = []

for (let ts = START; ts <= END; ts += 86400000) {
  const dt = new Date(ts)
  const y = dt.getUTCFullYear()
  const m = dt.getUTCMonth() + 1
  const d = dt.getUTCDate()

  const mine = solarToLunar(new Date(Date.UTC(y, m - 1, d, 12)))
  const lunar = Solar.fromYmd(y, m, d).getLunar()
  const monthCn = lunar.getMonthInChinese()
  const expectText = `${monthCn.startsWith('闰') ? '闰' : ''}${monthCn.replace(/^闰/, '')}月${lunar.getDayInChinese()}`

  checked++
  const ok = mine
    && mine.year === lunar.getYear()
    && mine.month === Math.abs(lunar.getMonth())
    && mine.day === lunar.getDay()
    && mine.isLeap === (lunar.getMonth() < 0)
    && mine.text === expectText

  if (!ok) {
    bad++
    if (samples.length < 10)
      samples.push({ date: `${y}-${m}-${d}`, mine, expectText })
  }
}

console.log(`比对 ${checked} 天，不一致 ${bad} 处`)
if (bad)
  console.log(JSON.stringify(samples, null, 2))

process.exit(bad ? 1 : 0)
