const root = document.documentElement;
const themeToggles = [...document.querySelectorAll('#theme-toggle, [data-drawer-theme]')];

initLegacyRoutes();
initTheme();
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

function initShortcuts() {
  const activeSearch = document.getElementById('search-input');
  if (document.body.dataset.view === 'search' && new URLSearchParams(location.search).has('focus')) activeSearch?.focus();

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

function initMobileNavigation() {
  const drawer = document.getElementById('mobile-drawer');
  const toggle = document.getElementById('mobile-menu-toggle');
  const close = document.getElementById('mobile-drawer-close');
  const bottomItems = [...document.querySelectorAll('.mobile-bottom-nav a, .mobile-bottom-nav button')];
  if (!drawer || !toggle) return;

  const setOpen = (open) => {
    if (drawer.open === open) return;
    if (open) {
      drawer.showModal();
      close.focus();
    } else drawer.close();
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open);
  };

  toggle.addEventListener('click', () => setOpen(!drawer.open));
  if (close) close.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer || event.target.closest('a')) setOpen(false);
  });
  drawer.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
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
    if (document.querySelector('dialog[open]')) return;
    palette.showModal();
    palette.querySelector('.command-item')?.focus();
  };
  const close = () => {
    palette.close();
  };
  document.addEventListener('keydown', (event) => {
    const commandKey = event.metaKey || event.ctrlKey;
    if (commandKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      palette.open ? close() : open();
    }
  });
  document.querySelector('[data-open-commands]')?.addEventListener('click', open);
  palette.querySelectorAll('[data-command-close]').forEach((node) => node.addEventListener('click', close));
  palette.addEventListener('click', (event) => {
    if (event.target.closest('a[href]') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) close();
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
  const mobileOutline = document.querySelector('.dossier-mobile-outline');
  const mobileLinks = new Map([...mobileOutline?.querySelectorAll('a') ?? []].map((link) => [link.hash, link]));
  const sections = [...outline.querySelectorAll('a')].map((link) => ({
    heading: document.getElementById(link.hash.slice(1)),
    link,
    mobileLink: mobileLinks.get(link.hash),
  })).filter(({ heading }) => heading);
  const outlineTitle = outline.querySelector('h2');
  let current;
  let anchorOffset;
  let frame = 0;

  const setCurrent = (section) => {
    if (current === section) return;
    current?.link.removeAttribute('aria-current');
    current?.mobileLink?.removeAttribute('aria-current');
    current = section;
    if (!current) return;
    current.link.setAttribute('aria-current', 'location');
    current.mobileLink?.setAttribute('aria-current', 'location');

    if (outline.scrollHeight <= outline.clientHeight || !outline.clientHeight) return;
    const top = outlineTitle.getBoundingClientRect().bottom;
    const bottom = outline.getBoundingClientRect().bottom;
    const linkBounds = current.link.getBoundingClientRect();
    if (linkBounds.top < top) outline.scrollTop += linkBounds.top - top;
    else if (linkBounds.bottom > bottom) outline.scrollTop += linkBounds.bottom - bottom;
  };

  const updateCurrent = () => {
    frame = 0;
    const atEnd = window.scrollY + root.clientHeight >= root.scrollHeight - 2;
    const section = atEnd ? sections.at(-1) : sections.findLast(({ heading }) =>
      heading.getBoundingClientRect().top <= anchorOffset + 4
    );
    setCurrent(section ?? sections[0]);
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(updateCurrent);
  };
  const measureOffset = () => {
    anchorOffset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    scheduleUpdate();
  };
  const revealFragment = () => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;
    for (let details = target.closest('details'); details; details = details.parentElement?.closest('details')) {
      details.open = true;
    }
    scheduleUpdate();
  };

  mobileOutline?.addEventListener('click', (event) => {
    if (event.target.closest('a')) mobileOutline.open = false;
  });
  document.querySelector('.dossier-toolbar a[href="#dossier-sources"]')?.addEventListener('click', () => {
    document.getElementById('dossier-sources').open = true;
  });

  revealFragment();
  measureOffset();
  window.addEventListener('hashchange', revealFragment);
  window.addEventListener('resize', measureOffset);
  document.addEventListener('scroll', scheduleUpdate, { passive: true });
}

initMobileNavigation();
initReadingMode();
initCommandPalette();
initReadingProgress();
initHeadingAnchors();
initDossierNavigation();
