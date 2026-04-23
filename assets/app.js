const searchInput = document.getElementById('search-input');
const resultsNode = document.getElementById('search-results');
const countNode = document.getElementById('search-count');
const clearButton = document.getElementById('search-clear');

if (searchInput && resultsNode && countNode && clearButton) {
  let items = [];

  const renderEmpty = (message) => {
    resultsNode.innerHTML = `<div class="empty-state">${message}</div>`;
  };

  const scoreMatch = (item, query) => {
    const title = normalize(item.title || '');
    const summary = normalize(item.summary || '');
    const tags = Array.isArray(item.tags) ? item.tags.map(normalize).join(' ') : '';
    const search = normalize(item.search || `${title} ${summary} ${tags}`);

    let score = 0;
    if (title === query) score += 120;
    if (title.startsWith(query)) score += 80;
    if (title.includes(query)) score += 45;
    if (tags.includes(query)) score += 30;
    if (summary.includes(query)) score += 16;
    if (search.includes(query)) score += 8;
    return score;
  };

  const renderCards = (matches, query) => {
    if (!matches.length) {
      renderEmpty(`Sin resultados para <strong>${escapeHtml(query)}</strong>.`);
      countNode.textContent = '0 resultados';
      return;
    }

    resultsNode.innerHTML = matches
      .map(({ item }) => `
        <a class="result-card" href="${item.url}">
          <div class="result-head">
            <h3>${escapeHtml(item.title)}</h3>
            <span>${escapeHtml(item.updated)}</span>
          </div>
          <p>${escapeHtml(item.summary)}</p>
          <div class="card-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        </a>
      `)
      .join('');

    countNode.textContent = `${matches.length} resultado${matches.length === 1 ? '' : 's'}`;
  };

  const updateSearch = () => {
    const query = normalize(searchInput.value);
    if (!query) {
      renderEmpty('Escribe para buscar en títulos, resúmenes y tags.');
      countNode.textContent = `${items.length} notas indexadas`;
      return;
    }

    const matches = items
      .map((item) => ({ item, score: scoreMatch(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || normalize(a.item.title).localeCompare(normalize(b.item.title)))
      .slice(0, 24);

    renderCards(matches, query);
  };

  hydrateItems()
    .then((data) => {
      items = Array.isArray(data)
        ? data.map((item) => ({
            ...item,
            tags: Array.isArray(item.tags) ? item.tags : [],
            search: normalize(item.search || `${item.title || ''} ${item.summary || ''} ${(item.tags || []).join(' ')}`)
          }))
        : [];

      renderEmpty('Escribe para buscar en títulos, resúmenes y tags.');
      countNode.textContent = `${items.length} notas indexadas`;
    })
    .catch(() => {
      renderEmpty('No se pudo cargar el índice de búsqueda.');
      countNode.textContent = 'búsqueda no disponible';
    });

  searchInput.addEventListener('input', updateSearch);
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    updateSearch();
    searchInput.focus();
  });

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName;
    const typingIntoField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

    if (event.key === '/' && !typingIntoField) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      updateSearch();
      searchInput.blur();
    }
  });
}

function hydrateItems() {
  const embedded = document.getElementById('search-data');
  if (embedded?.textContent) {
    return Promise.resolve(JSON.parse(embedded.textContent));
  }
  return fetch('search-index.json').then((response) => response.json());
}

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
