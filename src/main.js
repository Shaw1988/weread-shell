// 主进程：创建窗口、加载网页版、注入样式与脚本、注册快捷键
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// 这台机器上 Chromium 的 GPU 沙箱会导致进程直接崩溃（0xC0000005），
// 关闭 GPU 沙箱即可正常启动；渲染进程的沙箱不受影响。
app.commandLine.appendSwitch('disable-gpu-sandbox');

// 开发期开放调试端口，便于检查页面结构；打包后不开启
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

// 这台机器的显卡驱动与 Chromium 不兼容，硬件加速会导致滚动卡顿、闪退。
// 改用 CPU 软件渲染：阅读页面对性能要求不高，反而更稳定流畅。
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features', 'Vulkan');

// 数据目录：打包后在 exe 同级目录建 data 文件夹，登录态与缓存都放里面；
// 开发时仍然放项目内的 .userdata。
// 若 exe 所在目录不可写（例如放在 Program Files 或只读盘），回退到系统用户目录，
// 保证别人拿到这个单文件也能直接打开使用。
const EXE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);

function resolveDataDir() {
  if (process.env.WR_DATA_DIR) return process.env.WR_DATA_DIR;
  if (!app.isPackaged) return path.join(__dirname, '..', '.userdata');

  const portableDir = path.join(EXE_DIR, 'data');
  try {
    fs.mkdirSync(portableDir, { recursive: true });
    fs.accessSync(portableDir, fs.constants.W_OK);

    // 写一个探针文件，确认真的可写（部分网络盘 mkdir 会成功但写入失败）
    const probe = path.join(portableDir, '.write-test');
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);

    return portableDir;
  } catch {
    return app.getPath('userData');
  }
}

const DATA_DIR = resolveDataDir();

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {}

app.setPath('userData', DATA_DIR);

// 启动直接进书架；已登录且有在读的书时，由注入脚本自动打开上次阅读
const START_URL = 'https://weread.qq.com/web/shelf';

// 部分网站会屏蔽带 Electron 标识的 UA，这里伪装成普通 Chrome。
// 如果以后遇到“浏览器版本不受支持”之类的提示，改这里的版本号即可。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let win = null;

function readInject(file) {
  return fs.readFileSync(path.join(__dirname, 'inject', file), 'utf8');
}

// 把 style.css 和 script.js 注入当前页面
function inject() {
  if (!win || win.isDestroyed()) return;

  const css = readInject('style.css');
  const js = readInject('script.js');

  win.webContents
    .executeJavaScript(
      `(() => {
        let el = document.getElementById('wr-style');
        if (!el) {
          el = document.createElement('style');
          el.id = 'wr-style';
          document.head.appendChild(el);
        }
        el.textContent = ${JSON.stringify(css)};
      })()`
    )
    .catch(() => {});

  win.webContents.executeJavaScript(js).catch(() => {});
}

function toggleFullScreen() {
  if (win) win.setFullScreen(!win.isFullScreen());
}

function togglePill() {
  if (!win) return;
  win.webContents
    .executeJavaScript(
      `(() => {
        const p = document.getElementById('wr-clock');
        if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
      })()`
    )
    .catch(() => {});
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: '阅读器',
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setUserAgent(UA);
  win.loadURL(START_URL);

  // 单页应用切换路由不会触发 did-finish-load，所以两个事件都要挂
  win.webContents.on('did-finish-load', inject);
  win.webContents.on('did-navigate-in-page', inject);

  // 站外链接交给系统浏览器，避免应用被跳走
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/([a-z0-9-]+\.)*(weread\.qq\.com|qq\.com|weixin\.qq\.com)/i.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    win = null;
  });
}

// 菜单栏默认隐藏，但快捷键依然生效
function buildMenu() {
  const template = [
    {
      label: '视图',
      submenu: [
        { label: '沉浸模式（全屏）', accelerator: 'Control+Shift+H', click: toggleFullScreen },
        { label: '显示 / 隐藏 计时挂件', accelerator: 'Control+Shift+T', click: togglePill },
        { type: 'separator' },
        { label: '重新加载', accelerator: 'Control+R', role: 'reload' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (win) win.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        { label: '退出', accelerator: 'Control+Q', role: 'quit' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 崩溃日志：写入项目根目录 crash.log，方便定位闪退原因
function logCrash(message) {
  try {
    fs.appendFileSync(
      path.join(__dirname, '..', 'crash.log'),
      `${new Date().toISOString()} ${message}\n`
    );
  } catch {}
}

app.on('render-process-gone', (event, webContents, details) => {
  logCrash(`render-process-gone ${JSON.stringify(details)}`);
});

app.on('child-process-gone', (event, details) => {
  logCrash(`child-process-gone ${JSON.stringify(details)}`);
});
