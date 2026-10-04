import { ArrowUpLeft, ArrowUpRight, Github } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useLibrary, CompareDock } from './Library';
import { loadCatalog } from './catalog';
import type { Catalog } from './types';

export type Page =
  | 'studio'
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
            ['studio', '装车台'],
            ['bikes', '车型资料'],
            ['parts', '配件资料'],
            ['compare', '车型对比'],
            ['workshop', '骑行工具'],
            ['discover', '专题与发现'],
          ] as [Page, string][]
        ).map(([page, label]) => (
          <a
            key={page}
            className={active === page ? 'active' : ''}
            aria-current={active === page ? 'page' : undefined}
            href={page === 'studio' ? base : `${base}?view=${page}`}
          >
            {label}
            {page === 'garage' && library.saved.length > 0 && <small>{library.saved.length}</small>}
          </a>
        ))}
      </nav>
      <span className="header-caption">
        BUILD YOUR RIDE<span>选配 · 估价 · 比较</span>
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
      <nav className="footer-links" aria-label="页脚导航">
        <a href="https://hliangzhao.me/">
          <ArrowUpLeft size={15} aria-hidden="true" /> 返回学术主页
        </a>
        <a href="https://github.com/hliangzhao/velodex" target="_blank" rel="noreferrer">
          <Github size={15} aria-hidden="true" /> GitHub 仓库
        </a>
        <a href={`${base}?view=feedback`}>读者留言 ↗</a>
        <a href={`${base}?view=bikes`}>
          查阅车型资料 <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </nav>
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
    document.title = `${title} · VÉLODEX 装车与升级`;
  }, [title]);
}
