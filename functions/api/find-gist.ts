import {
  type Env,
  checkPassword,
  findConfigGist,
  handleError,
  jsonResponse,
} from '../_shared'

/** GET /api/find-gist - 查找当前用户已有的配置 Gist（需访问口令） */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 口令校验
    const authFail = checkPassword(context.request, context.env)
    if (authFail)
      return authFail

    if (!context.env.GITHUB_TOKEN)
      return jsonResponse({ error: '服务端未配置 GitHub Token' }, 500)

    const gistId = await findConfigGist(context.env.GITHUB_TOKEN)

    if (gistId)
      return jsonResponse({ found: true, gistId })

    return jsonResponse({ found: false })
  }
  catch (err: any) {
    return handleError(err)
  }
}
