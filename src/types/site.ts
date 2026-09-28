export interface Site {
  id: number
  name: string
  url: string
  /**
   * 一行说明（选填）。紧凑列表视图会把它显示在名称下方，
   * 图标网格视图不用它 —— 那种排版下名称已经占满一行，再塞一行小字会挤。
   */
  desc?: string
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
