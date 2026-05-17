interface CatalogSearchBarProps {
  value: string;
  onChange: (query: string) => void;
}

export function CatalogSearchBar({ value, onChange }: CatalogSearchBarProps) {
  return (
    <div className="catalog-searchbar">
      <span className="catalog-searchbar__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        id="catalog-search-input"
        type="search"
        className="catalog-searchbar__input"
        placeholder="Buscar por nombre de Pokémon…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-label="Buscar cartas por nombre"
      />
      {value ? (
        <button
          type="button"
          className="catalog-searchbar__clear"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
