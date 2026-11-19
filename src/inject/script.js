// 注入到网页里的脚本：日间护眼配色 + 电子表计时挂件
(() => {
  // 单页应用会重复执行，已存在就直接返回
  if (document.getElementById('wr-clock')) return;
  if (!document.body) return;

  const MODE_KEY = 'wr_clock_mode';
  const SEC_KEY = 'wr_clock_sec';
  const todayStr = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD

  // ---------------- 挂件 ----------------
  const clock = document.createElement('div');
  clock.id = 'wr-clock';
  clock.title = '单击切换：已阅读时长 / 本章剩余时间';
  const label = document.createElement('span');
  clock.appendChild(label);
  document.body.appendChild(clock);

  let mode = Number(localStorage.getItem(MODE_KEY) || 1);
  if (mode !== 1 && mode !== 2) mode = 1;

  // ---------------- 今日阅读时长 ----------------
  function loadSeconds() {
    try {
      const d = JSON.parse(localStorage.getItem(SEC_KEY) || '{}');
      if (d.date === todayStr()) return Number(d.sec) || 0;
    } catch {}
    return 0;
  }
  function saveSeconds() {
    try {
      localStorage.setItem(SEC_KEY, JSON.stringify({ date: todayStr(), sec: seconds }));
    } catch {}
  }
  let seconds = loadSeconds();

  // ---------------- 是否正在阅读 ----------------
  // 有章节正文容器就认为在阅读页（比只判断 URL 更可靠）
  const isReading = () =>
    !!document.querySelector('.readerChapterContent') || /\/reader/.test(location.href);

  // 用 requestAnimationFrame 的间隔近似判断窗口是否被遮挡 / 最小化：
  // Chromium 会节流被完全遮住或最小化窗口的渲染，帧间隔会明显变大。
  let lastFrame = performance.now();
  let frameGap = 0;
  function beat() {
    const now = performance.now();
    frameGap = now - lastFrame;
    lastFrame = now;
    requestAnimationFrame(beat);
  }
  requestAnimationFrame(beat);

  // ---------------- 章节进度 ----------------
  let scrollEl = null;
  let scrollCheckedAt = 0;
  let chapterKey = '';
  let progress = 0;

  function getScroller() {
    const now = Date.now();
    if (scrollEl && scrollEl.isConnected && now - scrollCheckedAt < 3000) return scrollEl;
    scrollCheckedAt = now;

    let best = null;
    let bestArea = 0;
    const nodes = document.querySelectorAll('div, main, section, article');
    for (const el of nodes) {
      if (el.scrollHeight - el.clientHeight < 200) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      const area = el.clientWidth * el.clientHeight;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }
    scrollEl = best || document.scrollingElement;
    return scrollEl;
  }

  function currentChapter() {
    const t = document.querySelector('.chapterTitle, [class*="chapterTitle"]');
    const s = t && t.textContent ? t.textContent.trim() : '';
    return s || location.pathname + location.hash;
  }

  // ---------------- 每帧判断是否计入 ----------------
  let counting = false;

  function tick() {
    const now = Date.now();
    counting =
      isReading() && frameGap < 1500 && document.visibilityState === 'visible';

    if (counting) {
      seconds += 1;
      if (seconds % 10 === 0) saveSeconds();
    }

    if (isReading()) {
      const key = currentChapter();
      if (key !== chapterKey) {
        chapterKey = key;
        charsTotal = chapterCharCount();
        charRefreshAt = now;
      }

      // 章节内容是异步渲染的，字数每 5 秒刷新一次
      if (now - charRefreshAt > 5000) {
        charsTotal = chapterCharCount();
        charRefreshAt = now;
      }

      const el = getScroller();
      if (el) {
        const total = el.scrollHeight;
        const seen = el.scrollTop + el.clientHeight;
        progress = total > 0 ? Math.min(1, Math.max(0, seen / total)) : 0;
      }
    } else {
      progress = 0;
      charsTotal = 0;
    }

    render();
  }

  // ---------------- 文案 ----------------
  // 成年人中文中等阅读速度，约 400 字 / 分钟
  const CHARS_PER_MIN = 400;

  // 当前章节总字数（去掉空白后统计）
  function chapterCharCount() {
    const el = document.querySelector('.readerChapterContent');
    if (!el) return 0;
    return (el.innerText || '').replace(/\s+/g, '').length;
  }

  let charsTotal = 0;
  let charRefreshAt = 0;

  // 能抓不到字数（如整章为图片）时，这个模式不可用
  const etaSupported = () => charsTotal > 300;

  function etaText() {
    if (!isReading() || !etaSupported()) return todayText();

    const remainChars = Math.max(0, Math.round(charsTotal * (1 - progress)));
    let secs = (remainChars / CHARS_PER_MIN) * 60;
    secs = Math.min(Math.max(secs, 0), 12 * 3600);

    if (secs < 60) return '预计 不到1分钟 读完本章';

    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `预计 ${h}小时${m}分钟 读完本章` : `预计 ${m}分钟 读完本章`;
  }

  // 今天已阅读：不满 1 小时只显示分钟，超过则显示 X小时Y分钟
  function todayText() {
    const totalMin = Math.floor(seconds / 60);
    if (totalMin < 60) return `今天已阅读${totalMin}分钟`;

    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `今天已阅读${h}小时${m}分钟` : `今天已阅读${h}小时`;
  }

  function render() {
    const canEta = isReading() && etaSupported();

    // 当前书籍抓不到字数时，这个模式不可用，自动退回今日阅读时长
    if (mode === 2 && !canEta) mode = 1;

    if (mode === 1) {
      label.textContent = todayText();
      clock.classList.toggle('wr-paused', !counting);
    } else {
      label.textContent = etaText();
      clock.classList.remove('wr-paused');
    }

    clock.title = canEta
      ? '单击切换：已阅读时长 / 本章剩余时间'
      : '单击切换显示内容';
  }

  // 单击切换显示模式；拿不到字数时不提供第二种模式
  clock.addEventListener('click', () => {
    if (mode === 1 && !(isReading() && etaSupported())) return;

    mode = mode === 1 ? 2 : 1;
    try {
      localStorage.setItem(MODE_KEY, String(mode));
    } catch {}
    render();
  });

  // ---------------- 日间模式检测 ----------------
  function parseColor(value) {
    const m = String(value || '').match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    return m.slice(0, 3).map(Number);
  }

  function luminance([r, g, b]) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 元素自身背景亮度；完全透明返回 null（说明要看更外层的容器）
  function bgLuminance(el) {
    const bg = getComputedStyle(el).backgroundColor;
    const rgb = parseColor(bg);
    if (!rgb) return null;
    if (/\d+(\.\d+)?\s*\)$/.test(bg) && String(bg).includes('rgba') && Number(bg.split(',').pop().replace(')', '')) === 0) {
      return null;
    }
    return luminance(rgb);
  }

  // 文字亮度：夜间模式一定是浅色字，日间是深色字，这个信号比背景更可靠
  function textLuminance(el) {
    const rgb = parseColor(getComputedStyle(el).color);
    return rgb ? luminance(rgb) : null;
  }

  // ---------------- 启动路由与首页精简 ----------------

  const HOME_TITLE_TEXTS = ['猜你喜欢', '榜单', '分类', '推荐', '排行榜', '热门推荐'];

  // 微信读书主页里的推荐、榜单、分类卡片，全部隐藏
  const HOME_BLOCK_SELECTORS = [
    '.wr_suggestion_card_wrapper',
    '.wr_index_page_rank_list_card',
    '.wr_index_page_category_list_content_card',
  ];

  function hideHomeExtras() {
    // 阅读页不处理
    if (document.querySelector('.readerChapterContent')) return;

    const mark = (el) => {
      if (!el || el.dataset.wrHidden === '1') return;
      el.dataset.wrHidden = '1';
      el.style.setProperty('display', 'none', 'important');
    };

    for (const sel of HOME_BLOCK_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        mark(el);

        // 顺带把包裹它的栏目区块一起收起来，避免留下空标题
        let parent = el.parentElement;
        for (let i = 0; i < 2 && parent; i++) {
          if (/section|module|block/i.test(String(parent.className || ''))) {
            mark(parent);
            break;
          }
          parent = parent.parentElement;
        }
      });
    }

    // 卡片隐藏后，栏目标题（猜你喜欢 / 榜单 / 分类）和旁边的按钮也要一起收掉
    for (const el of document.querySelectorAll('div, span, h1, h2, h3, p, a')) {
      if (el.children.length) continue;
      const text = (el.textContent || '').trim();
      if (!HOME_TITLE_TEXTS.includes(text)) continue;

      mark(el);
      mark(el.parentElement);
    }
  }

  // 在书架页找「继续阅读」入口，取层级最深（文字最贴合）的那个
  function findContinueButton() {
    const hits = [];
    for (const el of document.querySelectorAll('button, a, div, span')) {
      const text = (el.textContent || '').trim();
      if (text === '继续阅读' || text === '上次读到') hits.push(el);
    }
    hits.sort(
      (a, b) => a.getElementsByTagName('*').length - b.getElementsByTagName('*').length
    );
    return hits[0] || null;
  }

  const LAST_READER_KEY = 'wr-last-reader-url';

  // 记下当前阅读页地址，下次启动直接回到这里
  function rememberReader() {
    if (!location.pathname.startsWith('/web/reader/')) return;
    try {
      localStorage.setItem(LAST_READER_KEY, location.href);
    } catch {}
  }

  // 首次启动时自动进入上次在读的书；一次会话只尝试一次
  function tryAutoOpenBook() {
    if (sessionStorage.getItem('wr-boot') === '1') return;

    // 已经在阅读页，就是上次的位置
    if (location.pathname.startsWith('/web/reader/')) {
      sessionStorage.setItem('wr-boot', '1');
      return;
    }

    if (!location.pathname.includes('/shelf')) return;

    let last = '';
    try {
      last = localStorage.getItem(LAST_READER_KEY) || '';
    } catch {}

    if (last.includes('/web/reader/')) {
      sessionStorage.setItem('wr-boot', '1');
      location.href = last;
      return;
    }

    // 没有历史地址时，退回书架上的「继续阅读」入口
    const btn = findContinueButton();
    if (!btn) return;

    sessionStorage.setItem('wr-boot', '1');
    btn.click();
  }

  // ---------------- 主题 ----------------

  function syncTheme() {
    const root = document.documentElement;
    const chapter = document.querySelector('.readerChapterContent');
    let isDay = false;

    // 护眼配色只在阅读页生效，主页和书架保持官方原色
    if (chapter) {
      // 测量前先摘掉自己加的类，否则读到的永远是上次染的绿色，切夜间也回不去
      const hadClass = root.classList.contains('wr-day');
      if (hadClass) root.classList.remove('wr-day');

      // 微信读书夜间模式改的是文字颜色，底色往往还是白的，
      // 所以「深色字 + 浅色底」同时成立才判定为日间。
      const fg = textLuminance(chapter);
      let bg = null;
      for (let el = chapter; el && bg === null; el = el.parentElement) {
        bg = bgLuminance(el);
      }

      const darkText = fg !== null && fg < 128;
      const lightBg = bg === null || bg > 190;
      isDay = darkText && lightBg;

      if (isDay) root.classList.add('wr-day');
    } else {
      root.classList.remove('wr-day');
    }

    fixWhiteFrames(isDay);

    // 页面切换路由时 React 可能把挂件清掉，这里补挂回去
    if (!document.body.contains(clock)) document.body.appendChild(clock);
  }

  // 微信读书阅读页外面有一层铺满屏幕的白色容器，导致正文四周出现白框。
  // 这里动态找出「占屏幕一半以上 + 接近纯白」的元素，统一染成页面底色。
  function fixWhiteFrames(isDay) {
    const marked = document.querySelectorAll('.wr-fix-bg');

    if (!isDay) {
      marked.forEach((el) => el.classList.remove('wr-fix-bg'));
      return;
    }

    const viewport = innerWidth * innerHeight;
    for (const el of document.querySelectorAll('body *')) {
      if (el.classList.contains('readerChapterContent')) continue;
      if (el.classList.contains('wr-fix-bg')) continue;

      const r = el.getBoundingClientRect();
      if (r.width * r.height < viewport * 0.5) continue;

      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/\d+(\.\d+)?/g);
      if (!m || m.length < 3) continue;
      if (m.length > 3 && Number(m[3]) === 0) continue; // 全透明

      const [r0, g0, b0] = m.slice(0, 3).map(Number);
      if (0.299 * r0 + 0.587 * g0 + 0.114 * b0 > 235) {
        el.classList.add('wr-fix-bg');
      }
    }
  }

  // 未登录时，页面主体是空的；自动点开登录按钮，直接弹出扫码框
  function tryAutoLogin() {
    if (sessionStorage.getItem('wr-login') === '1') return;
    if (document.querySelector('.login_dialog_container')) return;

    const btn = document.querySelector('button.navBar_link_Login');
    if (!btn) return; // 已登录时这个按钮不存在

    sessionStorage.setItem('wr-login', '1');
    btn.click();
  }

  syncTheme();
  hideHomeExtras();
  rememberReader();
  tryAutoOpenBook();
  tryAutoLogin();
  setInterval(() => {
    syncTheme();
    hideHomeExtras();
    rememberReader();
    tryAutoOpenBook();
    tryAutoLogin();
  }, 2000);
  setInterval(tick, 1000);
  render();

  // 关闭或刷新前保存一次
  window.addEventListener('beforeunload', saveSeconds);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSeconds();
  });

  // 调试用：在控制台执行 __wrDebug() 可查看计时条件
  window.__wrDebug = () => ({
    href: location.href,
    reading: isReading(),
    frameGap: Math.round(frameGap),
    visibility: document.visibilityState,
    counting,
    seconds,
    charsTotal,
    progress: Number(progress.toFixed(3)),
    chapterKey,
    mode,
  });
})();
