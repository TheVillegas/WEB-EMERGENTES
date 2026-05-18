import { useBattleStore } from '../battle/store';
import { CatalogRoom } from './CatalogRoom';
import './catalog.css';

export function CatalogPage() {
  const catalogStatus = useBattleStore((s) => s.catalogStatus);

  if (catalogStatus === 'loading') {
    return (
      <div className="catalog-page catalog-page--loading" role="status" aria-live="polite">
        <div className="catalog-loader">
          <span className="catalog-loader__ring" aria-hidden="true" />
          <p>Cargando catálogo…</p>
        </div>
      </div>
    );
  }

  if (catalogStatus === 'error') {
    return (
      <div className="catalog-page catalog-page--error" role="alert">
        <p className="catalog-error-icon" aria-hidden="true">⚠️</p>
        <p className="catalog-error-title">No se pudo cargar el catálogo.</p>
        <p className="catalog-error-sub">Revisa tu conexión e intenta de nuevo.</p>
      </div>
    );
  }

  return (
    <div className="catalog-page catalog-page--3d">
      <CatalogRoom />
    </div>
  );
}
