const root = document.documentElement;
const searchInput = document.getElementById('search-input');
const resultsNode = document.getElementById('search-results');
const countNode = document.getElementById('search-count');
const clearButton = document.getElementById('search-clear');
const themeToggle = document.getElementById('theme-toggle');

initTheme();
initSearch();
initShortcuts();

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
    themeToggle.textContent = theme === 'light' ? 'Oscuro' : 'Claro';
    themeToggle.setAttribute('aria-label', `Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`);
  }
}

function initSearch() {
  if (!searchInput || !resultsNode || !countNode || !clearButton) return;

  let items = [];

  const renderCards = (matches, query) => {
    if (!matches.length) {
      resultsNode.innerHTML = `<div class="empty-state">Sin resultados para <strong>${escapeHtml(query)}</strong>.</div>`;
      countNode.textContent = '0 resultados';
      return;
    }

    resultsNode.innerHTML = matches.map((item) => `
      <a class="result-card" href="${item.url}">
        <div class="result-head">
          <h3>${escapeHtml(item.title)}</h3>
          <span>${escapeHtml(item.updated)}</span>
        </div>
        <p>${escapeHtml(item.summary)}</p>
        <div class="card-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      </a>
    `).join('');
    countNode.textContent = `${matches.length} resultado${matches.length === 1 ? '' : 's'}`;
  };

  const searchItems = (query) => {
    return items
      .map((item) => ({ ...item, score: scoreItem(item, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'es'))
      .slice(0, 24);
  };

  const updateSearch = () => {
    const query = normalize(searchInput.value);
    if (!query) {
      resultsNode.innerHTML = '<div class="empty-state">Escribe para buscar en títulos, resúmenes y tags.</div>';
      countNode.textContent = `${items.length} notas indexadas`;
      return;
    }
    renderCards(searchItems(query), query);
  };

  hydrateItems()
    .then((data) => {
      items = Array.isArray(data) ? data : [];
      resultsNode.innerHTML = '<div class="empty-state">Escribe para buscar en títulos, resúmenes y tags.</div>';
      countNode.textContent = `${items.length} notas indexadas`;
    })
    .catch(() => {
      resultsNode.innerHTML = '<div class="empty-state">No se pudo cargar el índice de búsqueda.</div>';
      countNode.textContent = 'búsqueda no disponible';
    });

  searchInput.addEventListener('input', updateSearch);
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    updateSearch();
    searchInput.focus();
  });
}

function initShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput && searchInput) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }

    if (event.key === 'Escape' && searchInput && document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.blur();
    }
  });
}

function hydrateItems() {
  const embedded = document.getElementById('search-data');
  if (embedded?.textContent) return Promise.resolve(JSON.parse(embedded.textContent));
  return fetch('search-index.json').then((response) => response.json());
}

function scoreItem(item, query) {
  let score = 0;
  if (item.title_norm?.includes(query)) score += 12;
  if (item.tags_norm?.includes(query)) score += 8;
  if (item.summary_norm?.includes(query)) score += 4;
  if (item.search?.includes(query)) score += 2;
  return score;
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
