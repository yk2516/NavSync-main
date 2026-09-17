# NavSync

一款极简的网址导航工具，基于 [COME COME](https://github.com/hellojuantu/comecome) 改进，支持云端同步，部署在 Cloudflare Pages，采用 **favicon 代理 + KV 缓存** 架构。

![演示截图](./1.jpg)

## 功能

- 个性主题切换（月白、初春、瀚海、大漠）
- 网址自定义（鼠标拖动排序）
- 搜索引擎自定义（百度、必应、谷歌、搜狗、维基百科）
- 搜索词自动提示
- 图标风格切换（鲜艳、朴素、灰白）
- 色彩模式切换（系统自动、夜间模式、日间模式）
- 导入、导出数据
- **云端同步**（基于 GitHub Gist + Cloudflare Pages Functions）
- **访问口令保护**（Token 存储在服务端环境变量中，前端不可见）
- **暴力破解防护**（5 次口令错误后锁定 15 分钟）
- **跨设备自动同步**（换设备后自动查找云端已有配置，无需手动同步 ID）
- **Favicon 懒加载**（图标异步加载、骨架占位、加载失败回退首字母彩色图标）
- **Favicon 代理 + KV 缓存**（后端统一代理第三方图标源，KV 缓存 30 天，同一域名仅回源一次）
- **站长 / 访客双身份**（站长可编辑与同步，访客全程只读，且直接看到站长云端配置的导航页）

---

## 站长 / 访客权限模型

站长与访客共用同一个网址，靠访问口令 `CLOUD_PASSWORD` 区分身份。

| | 站长（知道口令） | 访客（其他所有人） |
| --- | --- | --- |
| 首页内容 | 自己的导航（本地 + 云端） | 站长已上传到云端的导航 |
| 设置齿轮 | 可见 | **不可见** |
| `/setting` | 完整设置页 | 只有一个口令输入框 |
| 云端同步 / 重置 / 导入导出 | 可用 | **完全不渲染** |
| 增删改站点、拖拽排序 | 可用 | **不可用（只读）** |

工作原理：

```
站长本地编辑 → 「上传到云端」(需口令) → GitHub Gist
                                          ↓
                         /api/public-config（只读、无需口令）
                                          ↓
                                    访客首页渲染
```

- 访客通过 `GET /api/public-config` 拿到站长的导航数据，该接口**只读**、不返回任何凭据，也无法写入
- 所有写操作（`/api/upload`、`/api/download`、`/api/find-gist`）仍然强制校验口令，即便有人伪造前端状态也改不了数据
- 站长身份标记只在服务端口令校验通过后写入，且每次打开页面都会复验一次

> ⚠️ **务必设置 `CLOUD_PASSWORD`。** 留空时口令校验整体跳过，任何人都能进入设置页并覆盖你的配置。

**站长改动后记得点一次「上传到云端」**，访客端才会看到更新（公开接口有 60 秒边缘缓存）。

设置页底部的「退出管理（查看访客视角）」可以随时切回访客只读视图做自检。

---

## 一键部署

### 前置条件

- 一个 GitHub 账号
- 一个 Cloudflare 账号（免费即可）

整个过程约 10 分钟，无需服务器、无需域名、无需付费。

### 第一步：Fork 仓库

点击 GitHub 仓库右上角的 **Fork** 按钮，将项目复制到你的账号下。

> 仓库地址：[yk2516/NavSync](https://github.com/yk2516/NavSync)

Fork 完成后，你会在 `https://github.com/<你的用户名>/NavSync` 拥有一份完整副本。

### 第二步：获取 GitHub Token

GitHub Token 用于后端代你操作 Gist（创建、读取、更新）。**仅需 `gist` 权限**，不需要其他权限。

1. 打开 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 填写以下信息：
   - **Note**（备注）：随便写，如 `NavSync Cloud Sync`
   - **Expiration**（有效期）：按需选择
   - **Scopes**（权限）：**只勾选 `gist`**，其他都不勾
4. 点击页面底部的 **Generate token**
5. 复制生成的 Token（格式类似 `ghp_xxxxxxxxxxxx`），**页面关闭后无法再看到**

> 也可以直接点击这个快捷链接，会自动帮你选好 `gist` 权限：
> [创建 Token（预设 gist 权限）](https://github.com/settings/tokens/new?description=NavSync%20Cloud%20Sync&scopes=gist)

### 第三步：创建 KV 命名空间

favicon 缓存需要用到 Cloudflare KV，提前创建好，后续绑定时直接选用。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)（右上角可切换语言）
2. 左侧菜单进入 **Workers 和 Pages**（Workers & Pages）→ **KV**
3. 点击 **创建命名空间**（Create namespace）
4. **命名空间名称填 `navsync-favicon`**（建议照填，方便后续对照；也可以取其他名字，不影响功能）

### 第四步：在 Cloudflare Pages 部署

> 以下路径按 Cloudflare **中文界面** 写法，英文界面可对照括号里的英文。

1. 回到 **Workers 和 Pages**，点击 **创建应用程序**（Create）→ 选择 **Pages** → 点击 **连接到 Git**（Connect to Git）
2. 注意选的是 Pages，不是 Workers。页面底部有一行小字链接，点击可切换类型
3. 授权 Cloudflare 访问你的 GitHub，选择你 Fork 的 `NavSync` 仓库
4. 填写构建设置：
   - **框架预设**（Framework preset）：`Vue`
   - **构建命令**（Build command）：`npm run build`
   - **构建输出目录**（Build output directory）：`dist`
5. 展开底部的 **高级**（Advanced）设置，配置以下变量。共 5 项，分两类：

   **环境变量**（Environment variables）：

   | 变量名 | 必填 | 说明 | 示例值 |
   | --- | --- | --- | --- |
   | `GITHUB_TOKEN` | **是** | 第二步获取的 GitHub Token，仅需 `gist` 权限 | `ghp_xxxxxxxxxxxx` |
   | `CLOUD_PASSWORD` | **强烈建议** | 管理口令。同时用于云端同步鉴权和管理入口验证；留空则任何人都能编辑和同步 | `myStr0ngP@ssw0rd` |
   | `FAVICON_SOURCE` | 否 | favicon 第三方图标源：`google`（默认）/ `duckduckgo` / `0x3` | `google` |
   | `FAVICON_TTL` | 否 | favicon 缓存时长（秒），范围 `60` ~ `2592000`，默认 30 天 | `2592000` |

   **KV 绑定**（Bindings，不是环境变量）：

   | 变量名（binding） | 类型 | 必填 | KV 命名空间 | 说明 |
   | --- | --- | --- | --- | --- |
   | `FAVICON_KV` | KV 命名空间 | **是** | `navsync-favicon`（第三步创建的） | favicon 代理缓存，变量名必须填 `FAVICON_KV` |

   > 必填的只有两个：`GITHUB_TOKEN`（云端同步必需）和 `FAVICON_KV`（favicon 代理必需）。
   > `CLOUD_PASSWORD` 虽然技术上可选，但**强烈建议设置**——否则任何人都能进入设置页修改你的导航配置。

6. 绑定 KV 命名空间（`FAVICON_KV`）：
   - 在创建向导的 **绑定**（Bindings）区域点击 **添加绑定**（Add binding）
     （若创建时找不到该区域，部署完成后进入 **设置 → 绑定**，Settings → Bindings）
   - **类型**（Type）选 **KV 命名空间**（KV namespace）
   - **变量名称**（Variable name）填 **`FAVICON_KV`**（必须与上表一致）
   - **KV 命名空间** 选第三步创建的 **`navsync-favicon`**
   - 点保存
   - 若是在部署完成后再补绑定，保存后需到 **部署**（Deployments）页面点 **重新部署**（Redeploy）才会生效

7. 点击 **保存并部署**（Save and Deploy）

### 第五步：等待部署完成

Cloudflare 会自动拉取代码、安装依赖、构建并部署。通常 2-3 分钟内完成。

部署成功后，你会得到一个 `https://your-project.pages.dev` 的地址。也可以在 Pages 项目的 **自定义域**（Custom domains）中绑定自己的域名。

### 第六步：开始使用

1. 打开你的网站地址
2. 点击右上角设置齿轮进入设置页
3. 在云端同步区域输入你设置的 `CLOUD_PASSWORD`，点击验证
4. 验证通过后点击「上传到云端」即可同步配置
5. 换设备时，重复上述步骤后点击「从云端拉取」，会自动查找并下载你之前上传的配置

> 如果未设置 `CLOUD_PASSWORD` 环境变量，则无需口令即可同步（不推荐，任何人都能操作）。
> 连续 5 次口令错误后，该 IP 将被锁定 15 分钟。

**访客**打开同一个网址时，会直接看到站长已上传到云端的导航页面（只读），看不到设置入口，也无法编辑。

---

## 环境变量速查

部署步骤已包含完整配置。以下是常见疑问速查：

| 问题 | 回答 |
| --- | --- |
| `GITHUB_TOKEN` 在哪设置？ | Pages 项目 → **设置 → 环境变量**（Settings → Environment variables）→ 添加；或部署向导的 **高级**（Advanced）区域 |
| `CLOUD_PASSWORD` 不设置会怎样？ | 不启用口令保护，任何人都能同步你的配置、进入设置页。**强烈建议设置** |
| `FAVICON_KV` 为什么不在环境变量里？ | 它是 **KV 命名空间绑定**（KV namespace binding），需在 **设置 → 绑定**（Settings → Bindings）添加，属于另一类配置 |
| KV 命名空间叫什么？ | 建议命名 `navsync-favicon`，也可以取其他名字，只要绑定时选对即可 |
| 绑定时变量名填什么？ | **必须填 `FAVICON_KV`**，这是代码中读取的名称，不能改 |
| 补绑 KV 后不生效？ | 重新部署一次即可：**部署 → 重新部署**（Deployments → Redeploy） |
| `FAVICON_SOURCE` 能填什么？ | `google`（默认）/ `duckduckgo` / `0x3`，三选一；**不设置时默认 `google`** |
| `FAVICON_TTL` 范围？ | `60` ~ `2592000` 秒，超出会自动钳制到合法范围 |

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建生产版本（输出到 dist/）
npm run build

# 预览构建结果
npm run preview
```

> 本地开发时，Cloudflare Pages Functions（`/api/*`）不会运行。如需调试 API，建议用 `npx wrangler pages dev dist` 或直接部署到 Cloudflare Pages 预览环境。

---

## 常见问题

**Q: 部署后打开网站白屏？**

检查 Cloudflare Pages 的部署日志（Deployments → 点击具体的部署 → 查看构建日志）。常见原因：
- `GITHUB_TOKEN` 未设置或无效 → 不影响首页加载，但云端同步功能不可用
- 构建失败 → 确认构建命令是 `npm run build`、输出目录是 `dist`

**Q: 访客打开网站看到的是内置的默认导航页，不是我的配置？**

站长需要先在设置页点一次「上传到云端」。访客首页通过 `/api/public-config` 拉取站长云端配置，如果云端还没有数据，就会回退到内置预设页面。

**Q: 站长修改了导航但访客没看到更新？**

公开接口有 60 秒边缘缓存。等一分钟后刷新即可。也可以在 Cloudflare Dashboard 手动清除缓存。

**Q: 忘记了 `CLOUD_PASSWORD` 怎么办？**

去 Cloudflare Pages 项目的 **设置 → 环境变量** 中查看或重置。口令存储在服务端，前端无法查看。

**Q: 怎么让访客也能编辑？**

不能。访客模式是只读的，这是设计如此。如果你想给别人编辑权限，把 `CLOUD_PASSWORD` 告诉对方即可——知道口令的人就是站长。

---

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia（状态管理）
- UnoCSS（原子化 CSS）
- Naive UI（组件库）
- Cloudflare Pages Functions（后端 API）
- GitHub Gist（云端存储）

## 项目结构

```
├── functions/          # Cloudflare Pages Functions（后端 API）
│   ├── _shared.ts      # 共享工具：口令校验、限流、Gist 操作
│   └── api/
│       ├── status.ts          # GET  /api/status         — 服务状态
│       ├── verify-password.ts # POST /api/verify-password — 口令验证
│       ├── find-gist.ts       # GET  /api/find-gist      — 查找配置 Gist
│       ├── upload.ts          # POST /api/upload          — 上传配置
│       ├── download.ts        # GET  /api/download        — 下载配置
│       ├── public-config.ts   # GET  /api/public-config   — 访客只读配置
│       ├── user.ts            # GET  /api/user            — GitHub 用户信息
│       └── favicon/           # Favicon 代理 + KV 缓存
├── src/                # 前端源码
│   ├── stores/         # Pinia stores（admin / viewer / site / setting / ...）
│   ├── composables/    # 组合式函数（bootstrap / dark / ...）
│   ├── utils/          # 工具函数（cloud / publicConfig / ...）
│   ├── pages/          # 页面（home / setting）
│   └── components/     # 组件
├── public/             # 静态资源
├── .env.example        # 环境变量配置参考
└── package.json
```

## 致谢

- [COME COME](https://github.com/hellojuantu/comecome)
- [Moon-Web-Start](https://github.com/jic999/moon-web-start)
- [0x3](https://0x3.com)

## License

MIT
