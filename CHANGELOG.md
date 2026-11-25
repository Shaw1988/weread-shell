# 更新日志

所有值得记录的项目变更都会归档到这个文件里。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [0.1.1] - 2026-11-25

### 修复

- **跨设备阅读进度不同步**：启动时自动打开上次在读的书，原先直接跳转到带 hash 的完整地址（例如 `.../web/reader/xxx#c-3-15-1`），前端会优先按 URL 里的旧位置定位，覆盖掉云端的最新进度。现在跳转前会去掉 hash，让微信读书自己向服务器拉取最新阅读位置，手机 / 其他设备上的进度可以正常同步过来。

---

## [0.1.0] - 2026-11-19

首次公开发布，非官方微信读书桌面壳。

### 新增

- **独立桌面窗口**：基于 Electron 38 搭建，窗口尺寸 1280×860，启动直达书架页 `weread.qq.com/web/shelf`
- **护眼日间模式**：纯白背景替换为 LCD 电子纸配色（米灰底 `#C0D3D7` + 墨绿字 `#111111`），自动检测页面主题切换
- **阅读计时挂件**：右下角半透明（默认透明度 0.6）小方块，LCD 老式电子表风格配色；两种显示模式：
  - 模式 1：本次阅读累计时长（跨天自动归零）
  - 模式 2：预计读完当前章节剩余时长（按 400 字/分钟估算）
  - 鼠标单击切换模式，偏好持久化
- **主页净化**：自动隐藏书架页的推荐、榜单、分类等多余模块
- **自动弹登录二维码**：未登录状态下检测到登录按钮时自动触发，`sessionStorage` 标记防反复骚扰
- **沉浸模式**：快捷键 `Ctrl+Shift+H` 切换
- **全局快捷键**：`Ctrl+Shift+T` 切换挂件显示、`F12` 开发者工具、`Ctrl+R` 刷新、`Ctrl+Q` 退出
- **SPA 路由监听**：微信读书单页应用路由切换时自动重新注入样式和脚本
- **数据目录策略**：便携版 exe 同级自动创建 `data/` 文件夹，不可写时回退到系统用户数据目录
- **GPU 加速禁用**：默认关闭硬件加速，避免部分显卡驱动下 Chromium GPU 进程崩溃（0xC0000005）

### 优化

- **体积裁剪**：Electron 多语言包仅保留 `zh-CN` + `en-US`；移除 `locales/` 多余语言、`dxcompiler/` `dxil/` `d3dcompiler_47/` `vk_swiftshader/` `vulkan/` 等软件渲染不需要的组件，最终单文件便携版约 **68MB**
- **EXE 图标**：使用 `rcedit` 在打包后阶段注入图标和版本信息（`WereadDesktop.exe` 属性显示公司名、描述、版权等）

### 已知问题

- 无 GPU 加速，部分视频/动画场景可能略有卡顿
- 火绒安全软件等杀毒软件可能拦截未签名的 Electron 二进制，需手动加信任区
- 微信读书网页版页面结构变更可能导致注入脚本失效，需同步更新 DOM 选择器

### 技术栈

| 组件 | 版本 | 说明 |
|------|------|------|
| Electron | 38.x | 因 Electron 45 在当前环境 GPU 沙箱初始化崩溃（0xC0000005），回退至 38 |
| electron-builder | latest | 单文件便携打包 `win.portable` |
| rcedit | latest | 写入 exe 图标和版本资源 |
| Node.js | 本地运行时 | 构建依赖 |

### 文件结构

```
weread-desktop/
├── src/
│   ├── main.js            # Electron 主进程
│   ├── preload.js         # 预加载脚本
│   └── inject/
│       ├── script.js      # 页面注入脚本（主题检测、计时、自动登录等）
│       └── style.css      # 页面注入样式（护眼配色、挂件样式）
├── build/
│   ├── afterPack.js       # 打包后处理（删语言包、写 exe 图标）
│   ├── make_icon.ps1      # 图标生成脚本
│   ├── icon-src.png       # 图标源文件
│   └── icon.ico           # 最终 ICO 图标
├── release/
│   └── WereadDesktop-0.1.0.exe  # 构建产物（.gitignore）
├── package.json
├── .gitignore
├── LICENSE                # MIT
├── README.md
└── CHANGELOG.md           # 本文件
```

### 致谢

- 微信读书网页版：https://weread.qq.com
- Electron 社区
