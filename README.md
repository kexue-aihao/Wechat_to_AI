# Wechat_to_AI

公众号接入 AI 的最小可运行示例。当前版本支持：

- 微信公众号消息回调
- DeepSeek 兼容 OpenAI 风格接口调用
- 显式开启 / 关闭 DeepSeek 思考模式
- 记录推理元信息（不直接输出完整推理链）

---

## 一、项目功能说明

当前项目是一个基于 `Express` 的公众号消息回调服务：

1. 微信把用户消息推送到你的服务器 `/wechat`
2. 服务端校验微信签名
3. 读取用户文本消息
4. 调用 DeepSeek 模型生成回复
5. 按微信要求返回 XML 文本消息

默认首页：

```text
GET /
```

会返回：

```text
wechat-to-ai server is running
```

微信回调地址：

```text
GET /wechat
POST /wechat
```

---

## 二、运行环境要求

### 1. 服务器要求

建议：

- Linux 服务器 1 台
- 已有公网 IP
- 已绑定域名
- 已开放 80 / 443 端口

推荐系统：

- Debian / Ubuntu / CentOS / Rocky Linux

### 2. 域名要求

你需要一个已经解析到服务器公网 IP 的域名，例如：

```text
bot.example.com
```

推荐：

- 先只做一条 A 记录
- 先确认浏览器可以访问域名
- 使用 HTTPS

### 3. 微信侧要求

需要有：

- 一个已可登录的正式公众号后台
- 可以进入开发配置 / 消息推送配置页面
- 可以修改 URL / Token / EncodingAESKey

### 4. DeepSeek 要求

你需要：

- DeepSeek API Key
- 能正常访问 `https://api.deepseek.com`

---

## 三、本项目依赖说明

本项目代码依赖：

- Node.js
- npm
- Express
- fast-xml-parser
- openai Node SDK
- dotenv

`package.json` 中已定义依赖，执行安装命令即可：

```powershell
npm.cmd install
```

或者 Linux 下：

```bash
npm install
```

---

## 四、aaPanel 部署前，面板里需要安装什么

根据 aaPanel 官方文档与本项目的实际部署方式，建议至少安装下面这些组件：

### 必装 1：Nginx
路径：

```text
App Store -> Nginx
```

作用：

- 处理 80 / 443 访问
- 绑定域名
- 配置 HTTPS 证书
- 反向代理到 Node 项目

### 必装 2：Node.js 管理相关插件
常见名称可能是以下之一：

- `Node.js Version Manager`
- `Node.js Project`
- `Node Project Manager`

路径通常是：

```text
App Store -> 搜索 Node
```

作用：

- 安装 Node.js 版本
- 创建 Node 项目
- 托管启动脚本
- 管理进程（通常由 aaPanel 接管 PM2）
- 查看日志 / 重启项目

### 必装 3：Node.js LTS 版本
建议安装一个 LTS 版本，例如你现在已安装的：

```text
Node v24.18.0 LTS
```

> 不建议优先使用过新的非稳定版本。

### 推荐安装 4：SSL 证书功能
通常在网站管理里直接配置，无需单独复杂安装。

作用：

- 给域名启用 HTTPS
- 微信公众号消息推送地址通常应使用 HTTPS

---

## 五、从零开始部署到 aaPanel 的完整步骤

下面按你这类项目的实际顺序来。

### 第 1 步：把代码上传到服务器

建议项目目录：

```text
/www/wwwroot/wechat-to-ai
```

上传后目录中至少应有：

- `server.js`
- `package.json`
- `package-lock.json`
- `.env.example`

如果没有 `.env`，稍后再创建。

---

### 第 2 步：安装项目依赖

你可以用 aaPanel 文件管理器上传后，在终端中进入项目目录执行：

```bash
cd /www/wwwroot/wechat-to-ai
npm install
```

如果你是在 Windows 本地先装好再传服务器，不建议直接把本地 `node_modules` 原样拷过去，最好在服务器重新执行一次 `npm install`。

---

### 第 3 步：创建 `.env`

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

然后把 `.env` 改成你的真实配置，例如：

```env
PORT=3000
WECHAT_TOKEN=你的微信Token
AI_PROVIDER=deepseek
AI_API_KEY=你的DeepSeek_API_Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_ERROR_REPLY=AI 服务当前暂时不可用，请稍后再试。
DEEPSEEK_THINKING=enabled
DEEPSEEK_REASONING_EFFORT=high
LOG_REASONING_META=true
```

说明：

- `WECHAT_TOKEN`：后面要和公众号后台配置一致
- `AI_API_KEY`：填 DeepSeek Key
- `AI_MODEL`：推荐先用 `deepseek-v4-flash`
- `DEEPSEEK_THINKING=enabled`：显式开启思考模式
- `LOG_REASONING_META=true`：日志里打印推理元信息

---

### 第 4 步：在 aaPanel 安装 Node 版本

进入：

```text
App Store -> Node.js Version Manager / Node.js Project
```

选择你已经安装或准备安装的 LTS 版本，例如：

```text
v24.18.0
```

---

### 第 5 步：在 aaPanel 创建 Node 项目

进入：

```text
Website -> Node Project
```

然后新建项目，通常需要填以下内容：

#### 1）Project path / Project directory
填你的项目目录，例如：

```text
/www/wwwroot/wechat-to-ai
```

#### 2）Project name
例如：

```text
wechat_to_ai
```

#### 3）Node version
选择：

```text
v24.18.0
```

#### 4）Start method / Run command / Startup file
如果 aaPanel 提供“从 `package.json` 读取自定义运行命令”，优先用它。

因为你的 `package.json` 里有：

```json
"scripts": {
  "start": "node server.js"
}
```

如果面板不是读取 `package.json`，那就手动指定：

- 启动文件：`server.js`
- 或启动命令：`node server.js`

#### 5）Port
填：

```text
3000
```

这里要和 `.env` 里的：

```env
PORT=3000
```

保持一致。

#### 6）Run user
一般保持默认，例如：

```text
www
```

#### 7）Power on / Auto start
建议开启。

这样面板重启或服务器重启后项目能自动拉起。

---

### 第 6 步：绑定域名

在 Node 项目里绑定你的正式域名，例如：

```text
bot.example.com
```

如果面板要求填写端口展示，通常会看到类似：

```text
bot.example.com:80
```

这是正常的，外部访问仍然通过域名，Node 实际监听内部 3000 端口。

---

### 第 7 步：配置 Nginx / 反向代理

如果 aaPanel 的 Node Project 自动帮你做了域名映射和反向代理，通常不需要手动再写一遍。

你只需要确认：

- 域名访问能到 Node 项目
- 首页能看到：

```text
wechat-to-ai server is running
```

如果你打开域名首页看到这句，说明：

- Nginx 正常
- Node 项目正常
- 反向代理正常

---

### 第 8 步：申请 SSL 证书

进入：

```text
Website -> 你的域名站点 -> SSL
```

推荐使用：

- Let's Encrypt

证书生效后，确认可以正常访问：

```text
https://你的域名/
```

---

### 第 9 步：启动并检查日志

在 aaPanel Node 项目页启动项目后，查看日志。

正常应看到类似：

```text
[startup] server listening on http://localhost:3000
[startup] configure your WeChat callback path as /wechat
[startup] AI provider=deepseek, model=deepseek-v4-flash, baseURL=https://api.deepseek.com
[startup] DeepSeek thinking=enabled, reasoning_effort=high, log_reasoning_meta=true
```

如果没有报错，说明项目已正常启动。

---

### 第 10 步：先在浏览器里检查服务

打开：

```text
https://你的域名/
```

如果看到：

```text
wechat-to-ai server is running
```

说明部署通了。

---

## 六、微信公众号后台怎么配置

在公众号开发配置 / 消息推送页面中填写：

### URL

```text
https://你的公网域名/wechat
```

例如：

```text
https://bot.example.com/wechat
```

### Token
填你 `.env` 里的：

```env
WECHAT_TOKEN=你的微信Token
```

### EncodingAESKey

- 可以随机生成
- 当前阶段建议保留即可

### 消息加解密方式
建议先选：

```text
明文模式
```

因为当前项目就是按明文模式接入的。

---

## 七、如何确认 DeepSeek 思考模式已开启

给公众号发一个需要推理的问题，例如：

```text
9.11和9.8哪个更大？请认真判断后再回答
```

如果日志里看到类似：

```text
[deepseek-thinking] {
  model: 'deepseek-v4-flash',
  thinking: 'enabled',
  reasoningEffort: 'high',
  hasReasoning: true,
  reasoningLength: 1234
}
```

则说明：

- 已显式开启 thinking
- 这次响应返回了推理内容

你重点看：

- `hasReasoning: true`
- `reasoningLength > 0`

---

## 八、常见问题

### 1. 域名打开显示 502 / 503
通常说明：

- Node 项目没启动
- Node 监听端口和 aaPanel 配置端口不一致
- 反向代理没配好

先检查：

- `.env` 的 `PORT`
- aaPanel Node 项目端口
- 项目日志

### 2. 保存微信 URL 配置失败
通常检查：

- URL 是否写成了 `https://你的域名/wechat`
- `WECHAT_TOKEN` 是否和后台填写一致
- 服务是否在线
- HTTPS 是否正常

### 3. 公众号发消息无回复，但日志有 `[wechat] incoming`
说明：

- 微信链路已经打通
- 问题大多在 AI 调用侧

请检查：

- `AI_API_KEY`
- `AI_MODEL`
- DeepSeek 接口是否可达

### 4. `.env` 里该不该保留真实 Key
建议：

- 本地仓库不要保留真实 Key
- `.env` 已被 `.gitignore` 忽略
- 生产环境只在服务器上保留真实值

---

## 九、安全建议

- 不要把 `.env` 提交到 Git 仓库
- 不要在日志里打印真实 API Key
- 不建议直接把完整推理链输出给用户
- 生产环境建议只记录 `hasReasoning / reasoningLength` 这类元信息
- 微信后台先使用明文模式，等稳定后再考虑升级安全模式

---

## 十、本地开发命令

安装依赖：

```powershell
npm.cmd install
```

启动项目：

```powershell
npm.cmd start
```

语法检查：

```powershell
node --check server.js
```

---

## 十一、相关文件说明

- `server.js`：项目主服务文件
- `.env.example`：环境变量模板
- `.env`：本地或服务器实际配置（不要提交）
- `package.json`：依赖与启动脚本定义

---

## 参考资料

- aaPanel 官方文档首页：
  [https://www.aapanel.com/docs/](https://www.aapanel.com/docs/)
- aaPanel Node 管理文档：
  [https://www.aapanel.com/docs/Function/panel-node.html](https://www.aapanel.com/docs/Function/panel-node.html)
- 微信公众号接入概览：
  [https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html](https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html)
- 微信公众号接收普通消息：
  [https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Receiving_standard_messages.html](https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Receiving_standard_messages.html)
- 微信公众号被动回复消息：
  [https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Passive_user_reply_message.html](https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Passive_user_reply_message.html)
- DeepSeek 官方文档：
  [https://api-docs.deepseek.com/zh-cn/](https://api-docs.deepseek.com/zh-cn/)
