// 预加载脚本：在页面加载前运行，是“网页 ↔ 主进程”的桥。
// 现在只暴露一个版本号作为示例；以后要加文件导出、剪贴板等系统能力，从这里扩展。
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopShell', {
  version: '0.1.0',
});
