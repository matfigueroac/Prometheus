const root = document.documentElement;
const searchInput = document.getElementById('search-input');
const quickSearchInput = document.getElementById('quick-search-input');
const quickSearchForm = document.getElementById('quick-search-form');
const resultsNode = document.getElementById('search-results');
const countNode = document.getElementById('search-count');
const clearButton = document.getElementById('search-clear');
const themeToggle = document.getElementById('theme-toggle');
const homeSearchPath = 'index.html#search';

initTheme();
initSearch();
initShortcuts();
initActiveSectionNav();

function initTheme() {
  const stored = localStorage.getItem('xfiles-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(stored || preferred);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('xfiles-theme', next);
    });
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'light' ? 'Dark' : 'Light';
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
  }
}

function initSearch() {
  const hasMainSearch = !!(searchInput && resultsNode && countNode && clearButton);
  const hasQuickSearch = !!(quickSearchInput && quickSearchForm);
  if (!hasMainSearch && !hasQuickSearch) return;

  const params = new URLSearchParams(window.location.search);
  const initialQuery = normalize(params.get('q') || '');

  syncInputs(initialQuery, { skip: null });
  bindSuggestionChips();

  if (hasQuickSearch) {
    quickSearchForm.addEventListener('submit', (event) => {
      const query = normalize(quickSearchInput.value);
      if (hasMainSearch) {
        event.preventDefault();
        syncInputs(query, { skip: quickSearchInput });
        updateSearch();
        searchInput.focus();
        searchInput.select();
        return;
      }

      event.preventDefault();
      window.location.href = query ? `index.html?q=${encodeURIComponent(query)}#search` : homeSearchPath;
    });

    quickSearchInput.addEventListener('input', () => {
      if (!hasMainSearch) return;
      const query = normalize(quickSearchInput.value);
      syncInputs(query, { skip: quickSearchInput });
      updateSearch();
    });
  }

  if (!hasMainSearch) return;

  let items = [];

  const renderCards = (matches, query) => {
    if (!matches.length) {
      resultsNode.innerHTML = `<div class="empty-state">No results for <strong>${escapeHtml(query)}</strong>. Try <code>mars</code>, <code>cia</code>, <code>remote viewing</code>, or <code>uap</code>.</div>`;
      countNode.textContent = '0 results';
      updateSearchState(query, 0);
      return;
    }

    resultsNode.innerHTML = matches.map((item, index) => `
      <a class="result-card" href="${item.url}">
        <div class="result-rank">#${index + 1}</div>
        <div class="result-body">
          <div class="result-head">
            <h3>${highlightText(item.title, query)}</h3>
            <span>${escapeHtml(item.updated)}</span>
          </div>
          <div class="result-meta">
            <span class="result-pill">${escapeHtml(item.group || 'Archivo')}</span>
            <span class="result-pill result-pill-muted">${escapeHtml(item.kind || 'nota')}</span>
            <span class="result-pill result-pill-muted">${escapeHtml(item.source_path || 'Obsidian')}</span>
          </div>
          <p>${highlightText(item.summary, query)}</p>
          <div class="card-tags">${item.tags.map((tag) => `<span>${highlightText(tag, query)}</span>`).join('')}</div>
        </div>
      </a>
    `).join('');
    countNode.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
    updateSearchState(query, matches.length);
  };

  const searchItems = (query) => {
    return items
      .map((item) => ({ ...item, score: scoreItem(item, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'es'))
      .slice(0, 24);
  };

  function updateSearch() {
    const query = normalize(searchInput.value);
    syncInputs(query, { skip: searchInput });
    updateUrl(query);

    if (!query) {
      resultsNode.innerHTML = `
        <div class="empty-state empty-state-rich">
          <strong>Search ready.</strong>
          <span>Use the suggestions above or type a topic, source, tag, or dossier title.</span>
        </div>`;
      countNode.textContent = `${items.length} indexed notes`;
      updateSearchState('', items.length);
      return;
    }

    renderCards(searchItems(query), query);
  }

  hydrateItems()
    .then((data) => {
      items = Array.isArray(data) ? data : [];
      updateSearch();
    })
    .catch((error) => {
      console.error('Could not hydrate local index', error);
      resultsNode.innerHTML = '<div class="empty-state">Could not load the search index.</div>';
      countNode.textContent = 'search unavailable';
    });

  searchInput.addEventListener('input', updateSearch);
  clearButton.addEventListener('click', () => {
    syncInputs('', { skip: null });
    updateSearch();
    searchInput.focus();
  });
}

function initShortcuts() {
  document.addEventListener('keydown', (event) => {
    const activeSearch = searchInput || quickSearchInput;
    const activeElement = document.activeElement;
    const isTyping = activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');
    if (event.key === '/' && !isTyping && activeSearch) {
      event.preventDefault();
      activeSearch.focus();
      activeSearch.select();
    }

    if (event.key === 'Escape' && activeElement?.matches?.('#search-input, #quick-search-input')) {
      activeElement.value = '';
      activeElement.dispatchEvent(new Event('input'));
      activeElement.blur();
    }
  });
}

function hydrateItems() {
  const embedded = document.getElementById('search-data');
  if (embedded?.textContent) {
    return Promise.resolve(JSON.parse(decodeHtmlEntities(embedded.textContent)));
  }

  return fetch('search-index.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
}

function bindSuggestionChips() {
  document.querySelectorAll('.suggestion-chip').forEach((button) => {
    button.addEventListener('click', () => {
      const query = normalize(button.dataset.query || '');
      syncInputs(query, { skip: null });
      if (searchInput) {
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      }
    });
  });
}

function updateSearchState(query, count) {
  const shell = document.getElementById('search');
  if (!shell) return;
  shell.classList.toggle('has-query', !!query);
  shell.classList.toggle('has-results', Number(count) > 0);
  if (clearButton) {
    clearButton.disabled = !query;
    clearButton.setAttribute('aria-disabled', query ? 'false' : 'true');
  }
}

function syncInputs(query, { skip } = {}) {
  if (searchInput && skip !== searchInput) searchInput.value = query;
  if (quickSearchInput && skip !== quickSearchInput) quickSearchInput.value = query;
}

function updateUrl(query) {
  if (!searchInput) return;
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set('q', query);
    url.hash = 'search';
  } else {
    url.searchParams.delete('q');
    if (url.hash === '#search') url.hash = '';
  }
  window.history.replaceState({}, '', url);
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
  const safe = escapeHtml(String(value || ''));
  if (!query) return safe;

  const terms = [...new Set(query.split(' ').filter(Boolean))];
  if (!terms.length) return safe;

  let highlighted = safe;
  for (const term of terms) {
    const escapedTerm = escapeRegex(term);
    highlighted = highlighted.replace(new RegExp(`(${escapedTerm})`, 'gi'), '<mark>$1</mark>');
  }
  return highlighted;
}

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
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


function initActiveSectionNav() {
  const groupLinks = [...document.querySelectorAll('.site-links a[href^="index.html#group-"]')];
  if (!groupLinks.length || !('IntersectionObserver' in window)) return;

  const byHash = new Map(groupLinks.map((link) => [new URL(link.href, window.location.href).hash, link]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    groupLinks.forEach((link) => link.classList.remove('nav-active'));
    const active = byHash.get(`#${visible.target.id}`);
    if (active) active.classList.add('nav-active');
  }, { rootMargin: '-20% 0px -55% 0px', threshold: [0.12, 0.25, 0.5] });

  byHash.forEach((_, hash) => {
    const section = document.querySelector(hash);
    if (section) observer.observe(section);
  });
}

function initMobileNavigation() {
  const drawer = document.getElementById('mobile-drawer');
  const toggle = document.getElementById('mobile-menu-toggle');
  const close = document.getElementById('mobile-drawer-close');
  const bottomItems = [...document.querySelectorAll('.mobile-bottom-nav a, .mobile-bottom-nav button')];
  if (!drawer || !toggle) return;

  const setOpen = (open) => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('drawer-open', open);
  };

  toggle.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
  if (close) close.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer || event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  const current = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.hash}`;
  bottomItems.forEach((item) => {
    if (item.tagName === 'A') {
      const url = new URL(item.href, window.location.href);
      const itemKey = `${url.pathname.split('/').pop() || 'index.html'}${url.hash}`;
      if (current === itemKey || (!window.location.hash && itemKey === 'index.html')) item.classList.add('mobile-active');
    }
  });
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

initMobileNavigation();
initReadingMode();
initCommandPalette();
initReadingProgress();
initConstellationInteractions();
initHeadingAnchors();
