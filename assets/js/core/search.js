/** Поиск по таблицам и спискам (клиентская фильтрация) */
export function normalizeSearchQuery(q) {
  return (q || "").trim().toLowerCase();
}

export function rowMatchesQuery(textParts, query) {
  if (!query) return true;
  const hay = textParts.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(query);
}

export function bindSearchInput(inputId, onSearch, clearBtnId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const clearBtn = clearBtnId ? document.getElementById(clearBtnId) : null;
  let timer;

  const run = () => {
    const q = normalizeSearchQuery(input.value);
    if (clearBtn) clearBtn.classList.toggle("hidden", !q);
    onSearch(q);
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      run();
      input.focus();
    });
  }
}

export function searchBarHtml(id, placeholder, clearId) {
  const clear = clearId || `${id}Clear`;
  return `
    <div class="search-bar">
      <i class="fas fa-search search-bar__icon" aria-hidden="true"></i>
      <input type="search" id="${id}" class="search-bar__input" placeholder="${placeholder}" autocomplete="off">
      <button type="button" id="${clear}" class="search-bar__clear hidden" title="Очистить" aria-label="Очистить поиск">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
}
