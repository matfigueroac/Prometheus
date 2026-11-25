const searchInput = document.querySelector('[data-view="search"] #search-input');
const resultsNode = document.getElementById('search-results');
const countNode = document.getElementById('search-count');
const clearButton = document.getElementById('search-clear');

function initSearch() {
  if (!searchInput || !resultsNode || !countNode || !clearButton) return;
  const form = document.getElementById('library-search-form');
  const pager = document.getElementById('search-pager');
  const previous = document.getElementById('previous-results');
  const next = document.getElementById('next-results');
  const pageCount = document.getElementById('search-page-count');
  const resultsTitle = document.getElementById('search-results-title');
  const collection = document.getElementById('collection-filter');
  const resultsPerPage = 12;
  const params = new URLSearchParams(window.location.search);
  let page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  searchInput.value = params.get('q') || '';
  const catalog = document.getElementById('search-data');
  const items = JSON.parse(catalog.textContent).map((item) => ({
    ...item,
    title_norm: normalize(item.title),
    summary_norm: normalize(item.summary),
    tags_norm: normalize(item.tags.join(' ')),
    kind_norm: normalize(item.kind),
    group_norm: normalize(item.group === 'Other' ? 'Other Methods & media' : item.group),
  })).sort((a, b) => a.title.localeCompare(b.title, 'en'));
  const groups = [...new Set(items.map((item) => item.group))].sort();
  groups.forEach((group) => collection.add(new Option(group === 'Other' ? 'Methods & media' : group, group)));
  collection.value = groups.includes(params.get('collection')) ? params.get('collection') : '';
  collection.parentElement.hidden = false;

  let textState = 'idle';
  function loadText() {
    textState = 'loading';
    const script = document.createElement('script');
    script.src = catalog.dataset.textSrc;
    script.onload = () => {
      for (const item of items) {
        [item.search, item.archiveSummary] = archiveSearchText[item.url] || ['', ''];
      }
      textState = 'ready';
      updateSearch();
    };
    script.onerror = () => {
      textState = 'failed';
      updateSearch();
    };
    document.head.append(script);
  }

  function updateSearch() {
    const query = normalize(searchInput.value);
    if (query && textState === 'idle') loadText();
    const loading = Boolean(query) && textState === 'loading';
    resultsNode.setAttribute('aria-busy', String(loading));
    if (loading) {
      countNode.textContent = 'Searching…';
      return;
    }
    const candidates = collection.value ? items.filter((item) => item.group === collection.value) : items;
    const matches = query ? candidates
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'en'))
      .map(({ item }) => item) : candidates;
    const pages = Math.max(1, Math.ceil(matches.length / resultsPerPage));
    page = Math.min(page, pages);
    const start = (page - 1) * resultsPerPage;
    const pattern = highlightPattern(query);
    resultsNode.innerHTML = matches.length
      ? matches.slice(start, start + resultsPerPage).map((item) => renderSearchCard(item, pattern)).join('')
      : '<p class="empty-state">No dossiers match <strong>' + escapeHtml(query)
        + '</strong>. Try a different topic or clear the search.</p>';
    countNode.textContent = matches.length + (query ? (matches.length === 1 ? ' result' : ' results') : ' dossiers');
    if (query && textState === 'failed') countNode.textContent += ' · titles, summaries and tags only';
    clearButton.disabled = !searchInput.value && !collection.value;
    pager.hidden = pages === 1;
    previous.disabled = page === 1;
    next.disabled = page === pages;
    pageCount.textContent = 'Page ' + page + ' of ' + pages;
    updateSearchUrl(searchInput.value.trim(), page, collection.value);
  }

  updateSearch();

  const startSearch = () => {
    page = 1;
    updateSearch();
  };
  searchInput.addEventListener('input', startSearch);
  collection.addEventListener('change', startSearch);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    startSearch();
  });
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    collection.value = '';
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

function renderSearchCard(item, pattern) {
  const topic = item.group === 'Other' ? 'Methods & media' : item.group;
  return `
    <a class="library-card" href="${escapeHtml(item.url)}">
      <img class="library-card-image" src="${escapeHtml(item.thumbnail)}" width="480" height="320" loading="lazy" decoding="async" alt="">
      <div class="library-card-body">
        <div class="library-card-meta"><span>${escapeHtml(topic)}</span><span>${escapeHtml(item.updated)}</span></div>
        <h3>${highlightText(item.title, pattern)}</h3>
        <p>${highlightText(item.summary, pattern)}</p>
      </div>
    </a>
  `;
}

function updateSearchUrl(query, page, collection) {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  if (page > 1) url.searchParams.set('page', page);
  else url.searchParams.delete('page');
  if (collection) url.searchParams.set('collection', collection);
  else url.searchParams.delete('collection');
  url.searchParams.delete('focus');
  if (url.href === location.href) return;
  try {
    history.replaceState({}, '', url);
  } catch (error) {
    // Some browsers restrict history changes when the wiki is opened from disk.
    if (location.protocol !== 'file:' || error.name !== 'SecurityError') throw error;
  }
}

function scoreItem(item, query) {
  let score = 0;
  if (item.title_norm?.includes(query)) score += 16;
  if (item.tags_norm?.includes(query)) score += 10;
  if (item.kind_norm?.includes(query)) score += 7;
  if (item.group_norm?.includes(query)) score += 6;
  if (item.summary_norm.includes(query) || item.archiveSummary?.includes(query)) score += 4;
  if (item.search?.includes(query)) score += 2;
  return score;
}

function highlightPattern(query) {
  if (!query) return null;
  const terms = [...new Set(query.split(' ').filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  return new RegExp(`(${terms.join('|')})`, 'gi');
}

function highlightText(value, pattern) {
  if (!pattern) return escapeHtml(value);
  return value.split(pattern)
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

initSearch();
