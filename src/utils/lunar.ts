/**
 * 农历换算（公历 → 农历）
 *
 * 没有引入 lunar-javascript（300KB / gzip 105KB，只为一个日期字符串不值），
 * 而是用它生成了一张 1900-2100 的压缩表，配一份手写解码。
 * 生成与校验脚本见 .temp/gen-lunar-table.mjs：对 1900-01-31 ~ 2100-12-31
 * 共 73384 天逐日比对，结果与 lunar-javascript 完全一致。
 *
 * 表的编码沿用经典 lunarInfo 格式：
 *   bit 0-3   闰月月份（0 表示无闰月）
 *   bit 4-15  1-12 月的天数，1 = 30 天（`0x10000 >> m`）
 *   bit 16    闰月是否为 30 天
 */

const LUNAR_INFO = [
  0x4BD8, 0x4AE0, 0xA570, 0x54D5, 0xD260, 0xD950, 0x16554, 0x56A0,
  0x9AD0, 0x55D2, 0x4AE0, 0xA5B6, 0xA4D0, 0xD250, 0x1D255, 0xB540,
  0xD6A0, 0xADA2, 0x95B0, 0x14977, 0x4970, 0xA4B0, 0xB4B5, 0x6A50,
  0x6D40, 0x1AB54, 0x2B60, 0x9570, 0x52F2, 0x4970, 0x6566, 0xD4A0,
  0xEA50, 0x16A95, 0x5AD0, 0x2B60, 0x186E3, 0x92E0, 0x1C8D7, 0xC950,
  0xD4A0, 0x1D8A6, 0xB550, 0x56A0, 0x1A5B4, 0x25D0, 0x92D0, 0xD2B2,
  0xA950, 0xB557, 0x6CA0, 0xB550, 0x15355, 0x4DA0, 0xA5B0, 0x14573,
  0x52B0, 0xA9A8, 0xE950, 0x6AA0, 0xAEA6, 0xAB50, 0x4B60, 0xAAE4,
  0xA570, 0x5260, 0xF263, 0xD950, 0x5B57, 0x56A0, 0x96D0, 0x4DD5,
  0x4AD0, 0xA4D0, 0xD4D4, 0xD250, 0xD558, 0xB540, 0xB6A0, 0x195A6,
  0x95B0, 0x49B0, 0xA974, 0xA4B0, 0xB27A, 0x6A50, 0x6D40, 0xAF46,
  0xAB60, 0x9570, 0x4AF5, 0x4970, 0x64B0, 0x74A3, 0xEA50, 0x6B58,
  0x5AC0, 0xAB60, 0x96D5, 0x92E0, 0xC960, 0xD954, 0xD4A0, 0xDA50,
  0x7552, 0x56A0, 0xABB7, 0x25D0, 0x92D0, 0xCAB5, 0xA950, 0xB4A0,
  0xBAA4, 0xAD50, 0x55D9, 0x4BA0, 0xA5B0, 0x15176, 0x52B0, 0xA930,
  0x7954, 0x6AA0, 0xAD50, 0x5B52, 0x4B60, 0xA6E6, 0xA4E0, 0xD260,
  0xEA65, 0xD530, 0x5AA0, 0x76A3, 0x96D0, 0x4AFB, 0x4AD0, 0xA4D0,
  0x1D0B6, 0xD250, 0xD520, 0xDD45, 0xB5A0, 0x56D0, 0x55B2, 0x49B0,
  0xA577, 0xA4B0, 0xAA50, 0x1B255, 0x6D20, 0xADA0, 0x14B63, 0x9370,
  0x49F8, 0x4970, 0x64B0, 0x168A6, 0xEA50, 0x6B20, 0x1A6C4, 0xAAE0,
  0x92E0, 0xD2E3, 0xC960, 0xD557, 0xD4A0, 0xDA50, 0x5D55, 0x56A0,
  0xA6D0, 0x55D4, 0x52D0, 0xA9B8, 0xA950, 0xB4A0, 0xB6A6, 0xAD50,
  0x55A0, 0xABA4, 0xA5B0, 0x52B0, 0xB273, 0x6930, 0x7337, 0x6AA0,
  0xAD50, 0x14B55, 0x4B60, 0xA570, 0x54E4, 0xD160, 0xE968, 0xD520,
  0xDAA0, 0x16AA6, 0x56D0, 0x4AE0, 0xA9D4, 0xA2D0, 0xD150, 0xF252,
  0xD520,
]

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const DAY_CN = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 表覆盖的公历起点：1900-01-31 = 农历 1900 年正月初一 */
const BASE_UTC = Date.UTC(1900, 0, 31)
const MIN_YEAR = 1900
const MAX_YEAR = 2100

export interface LunarDate {
  year: number
  month: number
  day: number
  isLeap: boolean
  /** 中文月份，如「八」 */
  monthCn: string
  /** 中文日，如「初八」 */
  dayCn: string
  /** 完整中文，如「闰四月初八」 */
  text: string
}

function leapMonth(year: number) {
  return LUNAR_INFO[year - MIN_YEAR] & 0xF
}

function leapDays(year: number) {
  return leapMonth(year) ? ((LUNAR_INFO[year - MIN_YEAR] & 0x10000) ? 30 : 29) : 0
}

function monthDays(year: number, month: number) {
  return (LUNAR_INFO[year - MIN_YEAR] & (0x10000 >> month)) ? 30 : 29
}

function yearDays(year: number) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1)
    sum += (LUNAR_INFO[year - MIN_YEAR] & i) ? 1 : 0
  return sum + leapDays(year)
}

/** 公历 → 农历。超出 1900-2100 表范围时返回 undefined */
export function solarToLunar(date: Date): LunarDate | undefined {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  if (utc < BASE_UTC)
    return undefined

  let offset = Math.round((utc - BASE_UTC) / 86400000)
  if (offset < 0)
    return undefined

  let year = MIN_YEAR
  let temp = 0
  for (; year <= MAX_YEAR && offset > 0; year++) {
    temp = yearDays(year)
    offset -= temp
  }
  if (offset < 0) {
    offset += temp
    year--
  }
  if (year > MAX_YEAR)
    return undefined

  const leap = leapMonth(year)
  let isLeap = false
  let month = 1
  for (; month < 13 && offset > 0; month++) {
    if (leap > 0 && month === leap + 1 && !isLeap) {
      --month
      isLeap = true
      temp = leapDays(year)
    }
    else {
      temp = monthDays(year, month)
    }
    if (isLeap && month === leap + 1)
      isLeap = false
    offset -= temp
  }
  if (offset === 0 && leap > 0 && month === leap + 1) {
    if (isLeap) {
      isLeap = false
    }
    else {
      isLeap = true
      --month
    }
  }
  if (offset < 0) {
    offset += temp
    --month
  }

  const monthCn = MONTH_CN[month - 1] || ''
  const dayCn = DAY_CN[offset] || ''
  return {
    year,
    month,
    day: offset + 1,
    isLeap,
    monthCn,
    dayCn,
    text: `${isLeap ? '闰' : ''}${monthCn}月${dayCn}`,
  }
}

/** 农历节日（按「月-日」索引，闰月不计） */
const LUNAR_FESTIVALS: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵节',
  '2-2': '龙抬头',
  '5-5': '端午节',
  '7-7': '七夕',
  '7-15': '中元节',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '12-8': '腊八节',
}

/** 公历节日（按「月-日」索引） */
const SOLAR_FESTIVALS: Record<string, string> = {
  '1-1': '元旦',
  '2-14': '情人节',
  '3-8': '妇女节',
  '5-1': '劳动节',
  '6-1': '儿童节',
  '10-1': '国庆节',
  '12-25': '圣诞节',
}

/**
 * 取当天的节日名，公历节日优先。没有则返回空串。
 * 只是给时钟下方加一个信息点，不追求覆盖全部节气。
 */
export function getFestival(date: Date, lunar?: LunarDate): string {
  const solarKey = `${date.getMonth() + 1}-${date.getDate()}`
  if (SOLAR_FESTIVALS[solarKey])
    return SOLAR_FESTIVALS[solarKey]
  if (lunar && !lunar.isLeap) {
    const lunarKey = `${lunar.month}-${lunar.day}`
    if (LUNAR_FESTIVALS[lunarKey])
      return LUNAR_FESTIVALS[lunarKey]
  }
  return ''
}
