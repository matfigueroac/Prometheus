const searchInput = document.getElementById('search-input');
const resultsNode = document.getElementById('search-results');
const countNode = document.getElementById('search-count');
const clearButton = document.getElementById('search-clear');

if (searchInput && resultsNode && countNode && clearButton) {
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

  const updateSearch = () => {
    const query = normalize(searchInput.value);
    if (!query) {
      resultsNode.innerHTML = '<div class="empty-state">Escribe para buscar en títulos, resúmenes y tags.</div>';
      countNode.textContent = `${items.length} notas indexadas`;
      return;
    }
    const matches = items.filter((item) => item.search.includes(query)).slice(0, 24);
    renderCards(matches, query);
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

function hydrateItems() {
  const embedded = document.getElementById('search-data');
  if (embedded?.textContent) {
    return Promise.resolve(JSON.parse(embedded.textContent));
  }
  return fetch('search-index.json').then((response) => response.json());
}

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
