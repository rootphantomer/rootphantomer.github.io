/* ==========================================================================
   ph4nt0mer.github.io — 交互脚本
   原生 JS，无依赖。

   数据来源有三级，逐级降级，保证任何情况下页面都有内容：
     1) data/stats.json —— 由 GitHub Actions 定时生成的静态快照（同源、无 API 限额）
     2) GitHub REST API —— 快照缺失时实时拉取
     3) HTML 内嵌的静态兜底值
   ========================================================================== */
(function () {
  'use strict';

  var USERNAME = 'rootphantomer';
  var API = 'https://api.github.com';
  var STATS_FILE = 'data/stats.json';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 工具 */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function setStat(key, value) {
    var nodes = $$('[data-stat="' + key + '"]');
    if (!nodes.length) return;
    if (value === null || value === undefined || value === '') {
      nodes.forEach(function (n) { n.textContent = '—'; });
      return;
    }

    var target = Number(value);
    var isNum = isFinite(target) && key !== 'since';

    if (!isNum || reduceMotion) {
      nodes.forEach(function (n) { n.textContent = String(value); });
      return;
    }

    var start = performance.now();
    var duration = 850;

    nodes.forEach(function (node) {
      function step(now) {
        var p = Math.min((now - start) / duration, 1);
        var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
        node.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function sumStars(repos) {
    return (repos || []).reduce(function (acc, r) {
      return acc + (r.stars != null ? r.stars : (r.stargazers_count || 0));
    }, 0);
  }

  /* ------------------------------------------------------------ 主题切换 */
  function initTheme() {
    var root = document.documentElement;
    var btn = $('#themeToggle');
    var stored = null;

    try { stored = localStorage.getItem('ph4nt0mer:theme'); } catch (e) { /* 隐私模式 */ }

    if (stored === 'light' || stored === 'dark') {
      root.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      root.setAttribute('data-theme', 'light');
    }

    // URL 参数强制主题：?theme=dark / ?theme=light
    try {
      var forced = new URLSearchParams(location.search).get('theme');
      if (forced === 'light' || forced === 'dark') root.setAttribute('data-theme', forced);
    } catch (e) { /* noop */ }

    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('ph4nt0mer:theme', next); } catch (e) { /* noop */ }
    });
  }

  /* ------------------------------------------------------------ 移动端导航 */
  function initNav() {
    var toggle = $('#navToggle');
    var nav = $('#siteNav');
    if (!toggle || !nav) return;

    function close() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '展开导航菜单');
      nav.classList.remove('is-open');
    }

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      if (open) {
        close();
      } else {
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', '收起导航菜单');
        nav.classList.add('is-open');
      }
    });

    $$('a', nav).forEach(function (a) { a.addEventListener('click', close); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      close();
    });
  }

  /* -------------------------------------------------------- 顶栏滚动状态 */
  function initTopbar() {
    var bar = $('#topbar');
    if (!bar) return;
    var onScroll = function () {
      bar.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------ 滚动进场 */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = Array.prototype.slice.call(el.parentNode.children);
        var index = Math.max(0, siblings.indexOf(el));
        el.style.transitionDelay = Math.min(index * 70, 420) + 'ms';
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* --------------------------------------------------------- 卡片聚光灯 */
  function initSpotlight() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ------------------------------------------------------------ 数据渲染 */
  function applyData(profile, repos, totals, meta) {
    if (!profile) return;

    setStat('repos', profile.publicRepos);
    setStat('publicRepos', profile.publicRepos);
    setStat('followers', profile.followers);
    setStat('following', profile.following);
    setStat('since', profile.createdAt ? new Date(profile.createdAt).getFullYear() : null);
    setStat('stars', totals && totals.stars != null ? totals.stars : sumStars(repos));

    renderRepos(repos);
    fillCardStars(repos);

    var hint = $('#reposHint');
    if (hint && meta) {
      if (meta.live) {
        hint.textContent = '实时数据 · ' + new Date().toLocaleString('zh-CN', { hour12: false });
      } else if (meta.generatedAt) {
        hint.textContent = '静态快照 · 更新于 ' +
          new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false });
      }
    }
  }

  function fillCardStars(repos) {
    if (!repos) return;
    var map = {};
    repos.forEach(function (r) {
      map[r.name] = r.stars != null ? r.stars : (r.stargazers_count || 0);
    });

    $$('[data-repo]').forEach(function (el) {
      var name = el.getAttribute('data-repo');
      if (!(name in map)) return;
      var count = map[name];
      // 没有 star 的项目不显示徽标，避免一排「★ 0」
      if (!count) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      var span = el.querySelector('span');
      if (span) span.textContent = String(count);
    });
  }

  var FEATURED = [
    'nodewarden', 'quake_rs', 'DiPlay', 'baihu_web', 'agentctl',
    'Oopz_dmg', 'rootphantomer', 'rootphantomer.github.io',
  ];

  function renderRepos(repos) {
    var list = $('#reposList');
    if (!list || !repos || !repos.length) return;

    // 精选项目和 profile 仓库已在别处展示，这里列其余全部（含 fork）
    var others = repos
      .filter(function (r) { return FEATURED.indexOf(r.name) === -1; })
      .sort(function (a, b) {
        var sa = a.stars != null ? a.stars : (a.stargazers_count || 0);
        var sb = b.stars != null ? b.stars : (b.stargazers_count || 0);
        if (sb !== sa) return sb - sa;
        var ta = a.updatedAt || a.updated_at || '';
        var tb = b.updatedAt || b.updated_at || '';
        return tb < ta ? -1 : tb > ta ? 1 : 0;
      })
      .slice(0, 16);

    if (!others.length) return;

    list.innerHTML = '';
    others.forEach(function (r) {
      var isFork = r.isFork || r.fork;
      var li = document.createElement('li');
      li.className = 'repos__item';

      var name = document.createElement('a');
      name.className = 'repos__name';
      name.href = r.url || r.html_url || ('https://github.com/' + USERNAME + '/' + r.name);
      name.target = '_blank';
      name.rel = 'noopener noreferrer';
      name.textContent = r.name;

      if (isFork) {
        var badge = document.createElement('span');
        badge.className = 'repos__fork';
        badge.textContent = 'fork';
        badge.title = 'Fork 自其他仓库';
        name.appendChild(badge);
      }

      var desc = document.createElement('span');
      desc.className = 'repos__desc';
      desc.textContent = r.description || '—';

      var lang = document.createElement('span');
      lang.className = 'repos__lang';
      lang.textContent = r.language || '—';

      var stars = document.createElement('span');
      stars.className = 'repos__stars';
      stars.textContent = '★ ' + (r.stars != null ? r.stars : (r.stargazers_count || 0));

      li.appendChild(name);
      li.appendChild(desc);
      li.appendChild(lang);
      li.appendChild(stars);
      list.appendChild(li);
    });
  }

  /* -------------------------------------------------------- 数据加载（降级链）
     1) GitHub API      —— 实时数据（sessionStorage 缓存 10 分钟，减少重复请求）
     2) data/stats.json —— 手动生成的静态快照
     3) HTML 内嵌值      —— 最后兜底，保证页面永远不是空的
  */
  var CACHE_KEY = 'ph4nt0mer:gh-cache';
  var CACHE_TTL = 10 * 60 * 1000;

  function readApiCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.at || Date.now() - parsed.at > CACHE_TTL) return null;
      return parsed.data;
    } catch (e) { return null; }
  }

  function writeApiCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) { /* 隐私模式 */ }
  }

  function loadSnapshot() {
    // 同源静态文件：不受 GitHub API 限额影响
    return fetch(STATS_FILE, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function loadLive() {
    var headers = { Accept: 'application/vnd.github+json' };
    var cached = readApiCache();
    if (cached) return Promise.resolve(cached);

    return fetch(API + '/users/' + USERNAME, { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (profile) {
        if (!profile) return null;
        // 顺序发起第二个请求，避免并发触发 secondary rate limit
        return fetch(API + '/users/' + USERNAME + '/repos?per_page=100&sort=updated', { headers: headers })
          .then(function (r) { return r.ok ? r.json() : []; })
          .catch(function () { return []; })
          .then(function (repos) {
            var data = { profile: profile, repos: repos };
            writeApiCache(data);
            return data;
          });
      });
  }

  function loadData() {
    loadLive().then(function (live) {
      if (live && live.profile) {
        applyData(
          {
            publicRepos: live.profile.public_repos,
            followers: live.profile.followers,
            following: live.profile.following,
            createdAt: live.profile.created_at,
          },
          live.repos,
          null,
          { live: true }
        );
        return;
      }
      // API 不可用（限流 / 离线）→ 退回静态快照
      loadSnapshot().then(function (snap) {
        if (snap && snap.profile && snap.profile.login) {
          applyData(
            {
              publicRepos: snap.profile.publicRepos,
              followers: snap.profile.followers,
              following: snap.profile.following,
              createdAt: snap.profile.createdAt,
            },
            snap.repos || [],
            snap.totals,
            { generatedAt: snap.generatedAt }
          );
          return;
        }
        // 快照也没有 → 保留 HTML 内嵌的兜底值
        var hint = $('#reposHint');
        if (hint) hint.textContent = 'GitHub API 暂时不可用，显示的是内置快照数据。';
      });
    });
  }

  /* ------------------------------------------------------------------ 初始化 */
  function init() {
    initTheme();
    initNav();
    initTopbar();
    initReveal();
    initSpotlight();

    var yearEl = $('#footerYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
