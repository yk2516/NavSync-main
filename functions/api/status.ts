import { type Env, jsonResponse } from '../_shared'

/** GET /api/status - 返回是否启用口令模式 / 是否支持访客只读拉取 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const passwordMode = !!context.env.CLOUD_PASSWORD
  return jsonResponse({ passwordMode, publicRead: true })
}
