// 打包后处理：精简无关组件，并把图标写进 exe
const fs = require('node:fs');
const path = require('node:path');
const rceditMod = require('rcedit');
const rcedit = typeof rceditMod === 'function' ? rceditMod : rceditMod.rcedit || rceditMod.default;

const REMOVE_FILES = [
  'dxcompiler.dll', // DirectX 着色器编译器，仅硬件渲染需要
  'dxil.dll',
  'd3dcompiler_47.dll', // ANGLE 的 D3D 编译器，软件渲染用不到
  'vk_swiftshader.dll', // Vulkan 软渲染
  'vk_swiftshader_icd.json',
  'vulkan-1.dll',
];

const KEEP_LOCALES = new Set(['zh-CN.pak', 'en-US.pak']);

module.exports = async function afterPack(context) {
  const dir = context.appOutDir;

  for (const name of REMOVE_FILES) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  const localesDir = path.join(dir, 'locales');
  if (fs.existsSync(localesDir)) {
    for (const name of fs.readdirSync(localesDir)) {
      if (!KEEP_LOCALES.has(name)) fs.unlinkSync(path.join(localesDir, name));
    }
  }

  // 改名和图标：signAndEditExecutable 关闭时 electron-builder 不会写入，
  // 这里用 rcedit 直接改 exe 资源
  const exePath = path.join(dir, `${context.packager.appInfo.productFilename}.exe`);
  if (fs.existsSync(exePath)) {
    await rcedit(exePath, {
      icon: path.join(__dirname, 'icon.ico'),
      'file-version': '0.1.1.0',
      'product-version': '0.1.1.0',
      'version-string': {
        ProductName: '微信读书桌面版',
        FileDescription: '微信读书桌面版',
        CompanyName: '个人项目',
        LegalCopyright: '仅供个人学习使用',
        OriginalFilename: 'WereadDesktop.exe',
      },
    });
  }
};
