export interface Site {
  id: number
  name: string
  url: string
  favicon?: string
  /** 图标底色（十六进制），留空表示透明 */
  bgColor?: string
  /** 图标边距（px）：图标在底色方块内的内边距，仿极光Tab */
  iconPadding?: number
}
export interface Group {
  id: number
  name: string
  siteList: Site[]
}
export interface Category {
  id: number
  name: string
  groupList: Group[]
}
