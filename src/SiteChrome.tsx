import { ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useLibrary, CompareDock } from './Library';
import { loadCatalog } from './catalog';
import type { Catalog } from './types';

export type Page =
  | 'discover'
  | 'bikes'
  | 'parts'
  | 'stories'
  | 'garage'
  | 'compare'
  | 'workshop'
  | 'feedback'
  | 'teams';
export const base = import.meta.env.BASE_URL;
export function SiteHeader({ active }: { active: Page }) {
  const { library } = useLibrary();
  return (
    <header className="site-header experience-header">
      <a className="wordmark" href={base} aria-label="VÉLODEX 首页">
        <span className="logo-mark">V</span>VÉLODEX
      </a>
      <nav aria-label="主导航">
        {(
          [
            ['discover', '发现'],
            ['bikes', '整车图鉴'],
            ['parts', '配件图鉴'],
            ['stories', '专题'],
            ['teams', '车队与车手'],
            ['compare', '整车对比'],
            ['garage', '我的车库'],
            ['workshop', '工坊'],
          ] as [Page, string][]
        ).map(([page, label]) => (
          <a
            key={page}
            className={active === page ? 'active' : ''}
            aria-current={active === page ? 'page' : undefined}
            href={page === 'discover' ? base : `${base}?view=${page}`}
          >
            {label}
            {page === 'garage' && library.saved.length > 0 && <small>{library.saved.length}</small>}
          </a>
        ))}
      </nav>
      <span className="header-caption">
        FOR THE LOVE OF BIKES<span>每一台车，都值得多看一眼。</span>
      </span>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer>
      <a className="wordmark" href={base}>
        VÉLODEX
      </a>
      <span>献给每一个忍不住回头看车的人。</span>
      <a className="academic-home-link" href="https://hliangzhao.me/">
        <ArrowUpLeft size={15} aria-hidden="true" /> 返回学术主页
      </a>
      <a href={`${base}?view=feedback`}>读者留言 ↗</a>
      <a href={`${base}?view=bikes`}>
        继续逛图鉴 <ArrowUpRight size={16} />
      </a>
    </footer>
  );
}
export function PageFrame({
  active,
  children,
  dock = true,
}: {
  active: Page;
  children: ReactNode;
  dock?: boolean;
}) {
  return (
    <>
      <a className="skip-link" href="#page-content">
        跳转到内容
      </a>
      <SiteHeader active={active} />
      <main id="page-content" className="experience-page">
        {children}
      </main>
      <SiteFooter />
      {dock && <CompareDock />}
    </>
  );
}
export function CatalogContent({ children }: { children: (catalog: Catalog) => ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError(true));
  };
  useEffect(load, []);
  if (!catalog)
    return (
      <div className="load-state" role="status">
        <h1>{error ? '暂时无法读取图鉴' : '正在打开图鉴…'}</h1>
        {error && (
          <button className="dark-button" onClick={load}>
            重试
          </button>
        )}
      </div>
    );
  return <>{children(catalog)}</>;
}
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · VÉLODEX 公路车图鉴`;
  }, [title]);
}
