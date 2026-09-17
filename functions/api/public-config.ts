import {
  type Env,
  GIST_API_URL,
  GIST_FILE,
  fetchWithTimeout,
  findConfigGist,
  gistHeaders,
  handleError,
  jsonResponse,
} from '../_shared'

/**
 * GET /api/public-config - 只读公开接口
 *
 * 用途：让访客（非站长）打开首页时直接渲染站长已同步到云端的导航配置，
 *       而不是站点内置的初始预设页面。
 *
 * 安全说明：
 *   - 该接口**不校验访问口令**，任何人都可以读取；
 *   - 但它是纯只读的，不返回任何凭据（GitHub Token、访问口令都不在响应里），
 *     也无法通过它写入/修改/删除云端数据；
 *   - 所有写操作（upload / download / find-gist）仍然强制要求访问口令。
 *
 * 也就是说：访客只能「看」，不能「改」，也不能「同步」。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.GITHUB_TOKEN)
      return jsonResponse({ success: false, error: '服务端未配置 GitHub Token' }, 500)

    // 服务端用 Token 自行定位配置 Gist，前端无需（也无法）知道 Gist ID
    const gistId = await findConfigGist(context.env.GITHUB_TOKEN)
    if (!gistId)
      return jsonResponse({ success: false, error: '云端尚未上传配置' }, 404)

    const res = await fetchWithTimeout(`${GIST_API_URL}/${gistId}`, {
      headers: gistHeaders(context.env.GITHUB_TOKEN),
    })

    if (!res.ok)
      return jsonResponse({ success: false, error: `读取云端配置失败 (HTTP ${res.status})` }, 502)

    const gist = await res.json<any>()
    const content = gist?.files?.[GIST_FILE]?.content
    if (!content)
      return jsonResponse({ success: false, error: '云端配置为空' }, 404)

    let cloudData: any
    try {
      cloudData = JSON.parse(content)
    }
    catch {
      return jsonResponse({ success: false, error: '云端配置格式损坏' }, 500)
    }

    // 结构防御性校验，避免把坏数据推给访客前端
    if (!Array.isArray(cloudData?.data) || cloudData.data.length === 0 || !cloudData?.settings)
      return jsonResponse({ success: false, error: '云端配置结构异常' }, 500)

    // 只透出导航数据与展示设置，其余字段（updatedAt/version）按需返回
    const payload = {
      success: true,
      data: {
        data: cloudData.data,
        settings: cloudData.settings,
        updatedAt: cloudData.updatedAt ?? '',
      },
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // 边缘缓存 60s，显著降低 GitHub API 调用量；访客端可忽略缓存
        'Cache-Control': 'public, max-age=30, s-maxage=60',
      },
    })
  }
  catch (err: any) {
    return handleError(err)
  }
}
