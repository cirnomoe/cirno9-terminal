# ❄️ rime-terminal (`rime.moe`)

[![License: MIT](https://img.shields.io/badge/License-MIT-56c8ff.svg)](./LICENSE)
[![Built with Vite](https://img.shields.io/badge/Bundler-Vite-7bf0ff.svg)](https://vitejs.dev/)
[![Assisted by Gemini 4 Argon](https://img.shields.io/badge/AI-Gemini%204%20Argon-ffaa44.svg)](#致谢与声明)

基于 **Vite + 原生 Vanilla JavaScript** 构建的极客终端交互个人主页（Web CLI），无外部大型运行时依赖，完全在浏览器前端模拟运行。采用东方 Project 琪露诺（Cirno / ⑨）冰霜蓝调主题视觉风格。

- **在线站点**：[https://rime.moe](https://rime.moe)

---

## ✨ 特性概览

- **零外部运行时依赖**：纯原生 ES Modules + CSS Variables 实现，打包体积轻量、首屏秒开。
- **CRT 冰霜终端质感**：微弱扫描线、荧光泛晕、闪烁下划线光标 `_`，内置 `cirno`（默认冰霜蓝调）、`matrix`（磷光绿）、`amber`（复古琥珀）三套配色主题。
- **虚拟文件系统 (VFS)**：内存级树状目录结构，支持相对路径（`.`、`..`）与根路径（`~`）解析。
- **原生级键盘交互**：
  - `Tab`：自动补全命令名称、文件路径与主题预设名
  - `↑` / `↓`：遍历历史命令栈（自动保留当前未提交草稿）
  - `Ctrl + L`：快速清屏
  - `Ctrl + C`：中断当前输入行并新起提示符

---

## 💻 支持的终端指令

| 指令 | 说明 |
| :--- | :--- |
| `help` | 列出所有受支持的终端指令 |
| `ls [-l] [path]` | 列出目录内容 |
| `cd <path>` | 切换当前工作目录 |
| `cat <file>` | 查看文件内容 |
| `pwd` | 打印当前所在的工作目录绝对路径 |
| `clear` | 清空当前终端屏幕输出缓冲区 |
| `fastfetch` | 显示系统环境概览信息列表 |
| `theme [cirno\|matrix\|amber]` | 查看或切换终端配色主题 |
| `curl [url]` | 发起虚拟网络请求（如 `curl rime.moe`） |

---

## 📂 目录结构

```text
rime-terminal/
├── index.html              # 终端页面骨架与挂载入口
├── package.json            # 项目脚本与依赖配置
├── pnpm-workspace.yaml     # pnpm 构建白名单配置
├── src/
│   ├── main.js             # 应用初始化引导入口
│   ├── engine.js           # 终端状态机、按键拦截、Tab 补全与历史栈引擎
│   ├── commands.js         # 命令注册表、调度执行与安全 HTML 渲染
│   ├── vfs.js              # 虚拟文件系统树状结构与路径解析工具
│   └── styles/
│       ├── cirno.css       # 冰霜蓝调及多主题 CSS 变量体系
│       └── terminal.css    # 终端视口布局、CRT 扫描线与光标动画
└── tests/
    └── terminal.test.js    # 基于 Node.js 内置测试运行器的自动化单元测试
```

---

## 🚀 本地开发与部署

### 环境要求
- **Node.js** >= 20
- **pnpm** >= 10

### 常用命令

```bash
# 1. 安装依赖
pnpm install

# 2. 启动本地开发服务器
pnpm dev

# 3. 运行自动化单元测试
pnpm test

# 4. 构建生产环境静态产物 (输出至 dist/)
pnpm build

# 5. 本地预览生产构建结果
pnpm preview
```

---

## 🤖 致谢与声明

- 本项目使用 **Gemini 4 Argon** 辅助架构设计与代码编写。

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
