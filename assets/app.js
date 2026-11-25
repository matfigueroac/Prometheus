const root = document.documentElement;
const searchInput = document.querySelector('[data-view="search"] #search-input');
const resultsNode = document.getElementById('search-results');
const countNode = document.getElementById('search-count');
const clearButton = document.getElementById('search-clear');
const themeToggles = [...document.querySelectorAll('#theme-toggle, [data-drawer-theme]')];

initLegacyRoutes();
initTheme();
initSearch();
initShortcuts();

function initLegacyRoutes() {
  if (document.body.dataset.view !== 'home') return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('q')) {
    window.location.replace('search.html' + url.search);
    return;
  }
  const target = document.getElementById(url.hash.slice(1));
  if (target?.hasAttribute('data-legacy-topic')) window.location.replace(target.href);
  if (target?.hasAttribute('data-legacy-map')) window.location.replace('x-files.html' + url.hash);
}

function initTheme() {
  const stored = localStorage.getItem('xfiles-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(stored || preferred);

  themeToggles.forEach((button) => {
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('xfiles-theme', next);
    });
  });
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  const next = theme === 'light' ? 'dark' : 'light';
  const label = next === 'dark' ? 'Dark' : 'Light';
  themeToggles.forEach((button) => {
    button.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    button.textContent = button.hasAttribute('data-drawer-theme') ? label + ' theme' : label;
  });
}

function initSearch() {
  if (!searchInput || !resultsNode || !countNode || !clearButton) return;
  const form = document.getElementById('library-search-form');
  const pager = document.getElementById('search-pager');
  const previous = document.getElementById('previous-results');
  const next = document.getElementById('next-results');
  const pageCount = document.getElementById('search-page-count');
  const resultsTitle = document.getElementById('search-results-title');
  const resultsPerPage = 12;
  const params = new URLSearchParams(window.location.search);
  let page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  searchInput.value = params.get('q') || '';
  let items = null;

  function updateSearch() {
    if (!items) return;
    const query = normalize(searchInput.value);
    const matches = query ? items
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'en'))
      .map(({ item }) => item) : items;
    const pages = Math.max(1, Math.ceil(matches.length / resultsPerPage));
    page = Math.min(page, pages);
    const start = (page - 1) * resultsPerPage;
    resultsNode.innerHTML = matches.length
      ? matches.slice(start, start + resultsPerPage).map((item) => renderSearchCard(item, query)).join('')
      : '<p class="empty-state">No dossiers match <strong>' + escapeHtml(query)
        + '</strong>. Try a different topic or clear the search.</p>';
    countNode.textContent = matches.length + (query ? (matches.length === 1 ? ' result' : ' results') : ' dossiers');
    clearButton.disabled = !searchInput.value;
    pager.hidden = pages === 1;
    previous.disabled = page === 1;
    next.disabled = page === pages;
    pageCount.textContent = 'Page ' + page + ' of ' + pages;
    updateSearchUrl(searchInput.value.trim(), page);
  }

  hydrateItems()
    .then((data) => {
      if (!Array.isArray(data)) throw new Error('Invalid search index');
      items = data.sort((a, b) => a.title.localeCompare(b.title, 'en'));
      updateSearch();
    })
    .catch((error) => {
      console.error('Could not hydrate the search index', error);
      resultsNode.innerHTML = '<p class="empty-state">Could not load search. <a href="index.html#topic-hubs">Browse by topic</a>.</p>';
      countNode.textContent = 'Search unavailable';
    });

  const startSearch = () => {
    page = 1;
    updateSearch();
  };
  searchInput.addEventListener('input', startSearch);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    startSearch();
  });
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    startSearch();
    searchInput.focus();
  });
  document.querySelectorAll('.suggestion-chip').forEach((button) => {
    button.addEventListener('click', () => {
      searchInput.value = button.dataset.query || '';
      startSearch();
      searchInput.focus();
    });
  });

  const changePage = (step) => {
    page += step;
    updateSearch();
    resultsTitle.focus();
  };
  previous.addEventListener('click', () => changePage(-1));
  next.addEventListener('click', () => changePage(1));
}

function renderSearchCard(item, query) {
  const topic = item.group === 'Other' ? 'Methods & media' : item.group;
  return `
    <a class="library-card" href="${escapeHtml(item.url)}">
      <img class="library-card-image" src="${escapeHtml(item.thumbnail)}" width="480" height="320" loading="lazy" decoding="async" alt="">
      <div class="library-card-body">
        <div class="library-card-meta"><span>${escapeHtml(topic)}</span><span>${escapeHtml(item.updated)}</span></div>
        <h3>${highlightText(item.title, query)}</h3>
        <p>${highlightText(item.summary, query)}</p>
      </div>
    </a>
  `;
}

function initShortcuts() {
  const activeSearch = document.getElementById('search-input');
  if (searchInput && new URLSearchParams(window.location.search).has('focus')) searchInput.focus();

  document.addEventListener('keydown', (event) => {
    const activeElement = document.activeElement;
    const isTyping = activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');
    if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      if (!activeSearch) {
        window.location.href = 'search.html?focus=1';
        return;
      }
      activeSearch.focus();
      activeSearch.select();
    }

    if (event.key === 'Escape' && activeSearch && activeElement === activeSearch) {
      activeSearch.value = '';
      activeSearch.dispatchEvent(new Event('input'));
      activeSearch.blur();
    }
  });
}

async function hydrateItems() {
  const embedded = document.getElementById('search-data');
  if (embedded?.textContent) return JSON.parse(embedded.textContent);
  const response = await fetch('search-index.json');
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

function updateSearchUrl(query, page) {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  if (page > 1) url.searchParams.set('page', page);
  else url.searchParams.delete('page');
  url.searchParams.delete('focus');
  if (url.href !== window.location.href) window.history.replaceState({}, '', url);
}

function scoreItem(item, query) {
  let score = 0;
  if (item.title_norm?.includes(query)) score += 16;
  if (item.tags_norm?.includes(query)) score += 10;
  if (item.kind_norm?.includes(query)) score += 7;
  if (item.group_norm?.includes(query)) score += 6;
  if (item.summary_norm?.includes(query)) score += 4;
  if (item.search?.includes(query)) score += 2;
  return score;
}

function highlightText(value, query) {
  const source = String(value || '');
  if (!query) return escapeHtml(source);

  const terms = [...new Set(query.split(' ').filter(Boolean))]
    .sort((first, second) => second.length - first.length)
    .map(escapeRegex);
  if (!terms.length) return escapeHtml(source);

  return source.split(new RegExp(`(${terms.join('|')})`, 'gi'))
    .map((part, index) => index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part))
    .join('');
}

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


function initMobileNavigation() {
  const drawer = document.getElementById('mobile-drawer');
  const toggle = document.getElementById('mobile-menu-toggle');
  const close = document.getElementById('mobile-drawer-close');
  const bottomItems = [...document.querySelectorAll('.mobile-bottom-nav a, .mobile-bottom-nav button')];
  if (!drawer || !toggle) return;

  const setOpen = (open) => {
    if (drawer.classList.contains('is-open') === open) return;
    if (!open) toggle.focus();
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('drawer-open', open);
    if (open) close?.focus();
  };

  toggle.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
  if (close) close.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer || event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  const markCurrent = () => {
    const current = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.hash}`;
    bottomItems.filter((item) => item.tagName === 'A').forEach((item) => {
      const url = new URL(item.href, window.location.href);
      const itemKey = `${url.pathname.split('/').pop() || 'index.html'}${url.hash}`;
      const topicView = document.body.dataset.view === 'topic' && url.hash === '#topic-hubs';
      const active = current === itemKey || topicView;
      item.classList.toggle('mobile-active', active);
      if (active) item.setAttribute('aria-current', url.hash ? 'location' : 'page');
      else item.removeAttribute('aria-current');
    });
  };
  markCurrent();
  window.addEventListener('hashchange', markCurrent);
}

function initReadingMode() {
  const button = document.getElementById('reading-mode-toggle');
  if (!button) return;
  const key = 'xfiles-reading-mode';
  const apply = (enabled) => {
    document.body.classList.toggle('reading-mode', enabled);
    button.textContent = enabled ? 'Exit reading mode' : 'Reading mode';
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  };
  apply(localStorage.getItem(key) === '1');
  button.addEventListener('click', () => {
    const next = !document.body.classList.contains('reading-mode');
    localStorage.setItem(key, next ? '1' : '0');
    apply(next);
  });
}

function initCommandPalette() {
  const palette = document.getElementById('command-palette');
  if (!palette) return;
  const open = () => {
    palette.classList.add('is-open');
    palette.setAttribute('aria-hidden', 'false');
    palette.querySelector('.command-item')?.focus();
  };
  const close = () => {
    palette.classList.remove('is-open');
    palette.setAttribute('aria-hidden', 'true');
  };
  document.addEventListener('keydown', (event) => {
    const commandKey = event.metaKey || event.ctrlKey;
    if (commandKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      palette.classList.contains('is-open') ? close() : open();
    }
    if (event.key === 'Escape') close();
  });
  palette.querySelectorAll('[data-command-close]').forEach((node) => node.addEventListener('click', close));
  palette.querySelectorAll('[data-command-href]').forEach((node) => {
    node.addEventListener('click', () => {
      const href = node.getAttribute('data-command-href');
      if (href) window.location.href = href;
      close();
    });
  });
  palette.querySelector('[data-command-theme]')?.addEventListener('click', () => {
    document.getElementById('theme-toggle')?.click();
    close();
  });
  palette.querySelector('[data-command-reading]')?.addEventListener('click', () => {
    document.getElementById('reading-mode-toggle')?.click();
    close();
  });
}

function initReadingProgress() {
  const bar = document.getElementById('reading-progress-bar');
  if (!bar) return;
  const update = () => {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
    bar.style.width = `${pct}%`;
  };
  update();
  document.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

function initConstellationInteractions() {
  document.querySelectorAll('.constellation-node, .diagram-link').forEach((node) => {
    node.addEventListener('mouseenter', () => node.classList.add('is-focused'));
    node.addEventListener('mouseleave', () => node.classList.remove('is-focused'));
    node.addEventListener('focus', () => node.classList.add('is-focused'));
    node.addEventListener('blur', () => node.classList.remove('is-focused'));
  });
}

function initHeadingAnchors() {
  document.querySelectorAll('.note-body h2[id], .note-body h3[id], .note-body h4[id]').forEach((heading) => {
    if (heading.querySelector('.heading-anchor')) return;
    const link = document.createElement('a');
    link.className = 'heading-anchor';
    link.href = `#${heading.id}`;
    link.textContent = '#';
    link.setAttribute('aria-label', `Link to ${heading.textContent}`);
    heading.appendChild(link);
  });
}

function initDossierNavigation() {
  const outline = document.querySelector('.dossier-outline');
  if (!outline) return;
  const links = [...outline.querySelectorAll('a')];
  const headings = links
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter(Boolean);

  const setCurrent = (heading) => {
    links.forEach((link) => {
      if (link.hash.slice(1) === heading?.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const revealFragment = () => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;
    for (let details = target.closest('details'); details; details = details.parentElement?.closest('details')) {
      details.open = true;
    }
    if (headings.includes(target)) setCurrent(target);
  };

  const mobileOutline = document.querySelector('.dossier-mobile-outline');
  mobileOutline?.addEventListener('click', (event) => {
    if (event.target.closest('a')) mobileOutline.open = false;
  });
  document.querySelector('.dossier-toolbar a[href="#dossier-sources"]')?.addEventListener('click', () => {
    document.getElementById('dossier-sources').open = true;
  });

  revealFragment();
  window.addEventListener('hashchange', revealFragment);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible) setCurrent(visible.target);
    }, { rootMargin: '-80px 0px -65% 0px' });
    headings.forEach((heading) => observer.observe(heading));
  }
}

initMobileNavigation();
initReadingMode();
initCommandPalette();
initReadingProgress();
initConstellationInteractions();
initHeadingAnchors();
initDossierNavigation();
