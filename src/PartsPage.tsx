import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, CircleDot, Cog, Search, X } from 'lucide-react';
import type { PartsCatalog, PartCategory, Product } from './types';
import { imageUrl, loadCatalog, loadParts } from './catalog';
import './parts.css';
import { SiteHeader, SiteFooter } from './SiteChrome';

const categories: {
  id: PartCategory;
  name: string;
  en: string;
  headline: string;
  description: string;
}[] = [
  {
    id: 'wheels',
    name: '轮组',
    en: 'WHEELSETS',
    headline: '每一次加速，从这里开始。',
    description: '框高、内宽、花鼓与胎圈结构，一起决定轮组的性格。先看使用场景，再看重量。',
  },
  {
    id: 'groupsets',
    name: '变速系统',
    en: 'DRIVETRAINS',
    headline: '把每一分力量，传递下去。',
    description:
      '从机械拉线到无线电变，从 11 速到 13 速。齿比、操控与兼容性，比单一等级更值得了解。',
  },
  {
    id: 'tires',
    name: '轮胎',
    en: 'TIRES',
    headline: '与公路的接触，只有这一点。',
    description: '胎体、胶料与实际胎宽影响滚阻、抓地和舒适度。轮胎与轮圈，要作为一套系统来选。',
  },
];
const base = import.meta.env.BASE_URL;

export default function PartsPage() {
  const initial = new URLSearchParams(location.search);
  const currentSearch = useRef(location.search);
  const [catalog, setCatalog] = useState<PartsCatalog>();
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<PartCategory>(
    categories.find((c) => c.id === initial.get('category'))?.id || 'wheels',
  );
  const [selectedId, setSelectedId] = useState(initial.get('product') || '');
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [status, setStatus] = useState('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [bikes, setBikes] = useState<{ id: string; family: string; productIds: string[] }[]>([]);
  const load = () => {
    setError(false);
    loadParts()
      .then((data) => {
        setCatalog(data);
        const target = data.products.find(
          (p) => p.id === new URLSearchParams(location.search).get('product'),
        );
        if (target) setCategory(target.category);
      })
      .catch(() => setError(true));
  };
  useEffect(load, []);
  useEffect(() => {
    loadCatalog()
      .then((c) =>
        setBikes(
          c.bikes.map((b) => ({
            id: b.id,
            family: b.family,
            productIds: b.components.flatMap((p) => p.catalogIds || []),
          })),
        ),
      )
      .catch(() => {});
  }, []);
  const selected = catalog?.products.find((p) => p.id === selectedId);
  useEffect(() => {
    document.title = `${selected?.name || '配件图鉴'} · VÉLODEX`;
  }, [selected]);
  useEffect(() => {
    const back = () => {
      if (currentSearch.current === location.search) return;
      currentSearch.current = location.search;
      const p = new URLSearchParams(location.search);
      const target = catalog?.products.find((item) => item.id === p.get('product'));
      setSelectedId(target?.id || '');
      setCategory(
        target?.category || categories.find((c) => c.id === p.get('category'))?.id || 'wheels',
      );
      setBrand('all');
      setQuery('');
      setStatus('all');
      setCompareIds([]);
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [catalog]);
  const updateUrl = (cat: PartCategory, product = '') => {
    const url = new URL(location.href);
    url.searchParams.set('category', cat);
    if (product) url.searchParams.set('product', product);
    else url.searchParams.delete('product');
    history.pushState({}, '', url);
    currentSearch.current = url.search;
  };
  const pickCategory = (cat: PartCategory) => {
    setCategory(cat);
    setBrand('all');
    setSelectedId('');
    setCompareIds([]);
    setQuery('');
    setStatus('all');
    updateUrl(cat);
  };
  const openProduct = (product: Product) => {
    setSelectedId(product.id);
    updateUrl(product.category, product.id);
    requestAnimationFrame(() =>
      document.getElementById('part-detail')?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      }),
    );
  };
  const active = categories.find((c) => c.id === category)!;
  const brands =
    catalog?.brands.filter((b) =>
      catalog.products.some((p) => p.brandId === b.id && p.category === category),
    ) || [];
  const products =
    catalog?.products.filter(
      (p) =>
        p.category === category &&
        (brand === 'all' || p.brandId === brand) &&
        (status === 'all' || p.status === status) &&
        `${p.name} ${p.brandId} ${catalog.brands.find((b) => b.id === p.brandId)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
    ) || [];
  const compare = catalog?.products.filter((p) => compareIds.includes(p.id)) || [];
  const selectedBrand = catalog?.brands.find((b) => b.id === selected?.brandId);
  return (
    <>
      <a className="skip-link" href="#parts-list">
        跳转到配件列表
      </a>
      <SiteHeader active="parts" />
      <main className="parts-page">
        <div className="parts-hero">
          <div>
            <span className="eyebrow">THE DETAILS MAKE THE DIFFERENCE</span>
            <h1>
              每一处配置，
              <br />
              都有来历<span>。</span>
            </h1>
            <p>
              认识那些塑造骑行体验的名字。
              <br />
              从经典到前沿，读懂每个选择。
            </p>
          </div>
          <div className="parts-hero-art" aria-hidden="true">
            <PartDrawing category={category} />
            <span>FORM / FUNCTION / FEEL</span>
          </div>
          <span className="parts-count">
            {String(catalog?.products.length || 0).padStart(2, '0')}
            <small>COMPONENT ARCHIVES</small>
          </span>
        </div>
        <div className="parts-categories" role="group" aria-label="配件分类">
          {categories.map((c, i) => (
            <button key={c.id} aria-pressed={category === c.id} onClick={() => pickCategory(c.id)}>
              <span>0{i + 1}</span>
              <strong>{c.name}</strong>
              <small>{c.en}</small>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
        {!catalog ? (
          <div className="load-state" role="status">
            {error ? (
              <>
                <h2>配件资料暂时未能加载</h2>
                <button className="dark-button" onClick={load}>
                  重新加载
                </button>
              </>
            ) : (
              '正在整理配件档案…'
            )}
          </div>
        ) : (
          <>
            {selected && selectedBrand && (
              <article id="part-detail" className="part-detail-page">
                <div className="part-detail-top">
                  <span className="eyebrow">THE COMPONENT DOSSIER / {active.en}</span>
                  <button
                    aria-label="关闭配件详情"
                    onClick={() => {
                      setSelectedId('');
                      updateUrl(category);
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="part-detail-grid">
                  <div className="part-profile">
                    <span className="part-maker">{selectedBrand.name}</span>
                    <h2>{selected.name}</h2>
                    <p>{selected.tagline}</p>
                    <div className="part-profile-image">
                      {selected.image ? (
                        <img src={imageUrl(selected.image)} alt={selected.name} />
                      ) : (
                        <PartDrawing category={selected.category} />
                      )}
                    </div>
                    <small className="part-art-caption">
                      {selected.image ? '官方产品图 · 代表部件' : '类别结构示意'}
                    </small>
                    <span className="part-edition">
                      {selected.era} · {selected.status === 'classic' ? '经典档案' : '现行系列'}
                    </span>
                  </div>
                  <div className="part-specs">
                    <p className="part-description">{selected.description}</p>
                    <dl>
                      {selected.specs.map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <a
                      className="source-link"
                      href={selected.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.sourceLabel}
                      <ArrowUpRight size={15} />
                    </a>
                    <small className="part-date">资料核对 / {selected.checkedAt}</small>
                  </div>
                </div>
                <div className="performance-notes">
                  {selected.highlights.map((h, i) => (
                    <div key={h.title}>
                      <span>0{i + 1}</span>
                      <h3>{h.title}</h3>
                      <p>{h.text}</p>
                    </div>
                  ))}
                </div>
                <div className="part-choices">
                  <div>
                    <span className="eyebrow">FIT THE SYSTEM</span>
                    <h3>兼容与搭配</h3>
                    <p>{selected.compatibility}</p>
                  </div>
                  <div>
                    <span className="eyebrow">KNOW THE TRADE-OFF</span>
                    <h3>适用场景与取舍</h3>
                    <p>{selected.tradeoff}</p>
                  </div>
                  <div>
                    <span className="eyebrow">THE MAKER</span>
                    <h3>{selectedBrand.name}</h3>
                    <p>{selectedBrand.description}</p>
                    <a href={selectedBrand.website} target="_blank" rel="noreferrer">
                      访问厂商 <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>
                {!!bikes.filter((b) => b.productIds.includes(selected.id)).length && (
                  <div className="related-bikes">
                    <span>图鉴中搭载此系列的车型</span>
                    {bikes
                      .filter((b) => b.productIds.includes(selected.id))
                      .map((b) => (
                        <a key={b.id} href={`${base}?bike=${b.id}`}>
                          {b.family}
                          <ArrowUpRight size={13} />
                        </a>
                      ))}
                  </div>
                )}
              </article>
            )}
            <section id="parts-list" className="parts-library">
              <div className="parts-section-heading">
                <div>
                  <span className="eyebrow">
                    {active.en} / {products.length} PRODUCTS
                  </span>
                  <h2>{active.headline}</h2>
                  <p>{active.description}</p>
                </div>
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="搜索配件"
                    placeholder="搜索厂商、产品"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="parts-filters">
                <div role="group" aria-label="配件厂商">
                  <button aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>
                    所有厂商
                  </button>
                  {brands.map((b) => (
                    <button key={b.id} aria-pressed={brand === b.id} onClick={() => setBrand(b.id)}>
                      {b.name}
                    </button>
                  ))}
                </div>
                <label>
                  <span className="sr-only">配件世代</span>
                  <select
                    aria-label="配件世代"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">全部世代</option>
                    <option value="current">现行系列</option>
                    <option value="classic">经典档案</option>
                  </select>
                </label>
              </div>
              {compare.length > 0 && (
                <a className="parts-compare-jump" href="#parts-comparison">
                  已选 {compare.length} / 3 款 · 查看对比 <ArrowUpRight size={14} />
                </a>
              )}
              {products.length ? (
                <div className="parts-grid">
                  {products.map((p) => (
                    <article
                      className={`part-card ${selectedId === p.id ? 'selected' : ''}`}
                      key={p.id}
                    >
                      <button
                        className="part-card-main"
                        onClick={() => openProduct(p)}
                        aria-label={`查看 ${p.name}`}
                      >
                        <div className="part-card-top">
                          <span>{catalog.brands.find((b) => b.id === p.brandId)?.name}</span>
                          <small>{p.status === 'classic' ? 'CLASSIC' : 'CURRENT'}</small>
                        </div>
                        <div className="part-card-image">
                          {p.image ? (
                            <img src={imageUrl(p.image)} alt={p.name} loading="lazy" />
                          ) : (
                            <PartDrawing category={category} />
                          )}
                        </div>
                        <h3>{p.name}</h3>
                        <p>{p.tagline}</p>
                        <div className="part-card-facts">
                          {p.specs.slice(0, 2).map(([k, v]) => (
                            <span key={k}>
                              <small>{k}</small>
                              {v}
                            </span>
                          ))}
                        </div>
                      </button>
                      <div className="part-card-bottom">
                        <span>{p.era}</span>
                        <button
                          aria-label={`对比 ${p.name}`}
                          aria-pressed={compareIds.includes(p.id)}
                          disabled={!compareIds.includes(p.id) && compareIds.length >= 3}
                          onClick={() =>
                            setCompareIds((ids) =>
                              ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id],
                            )
                          }
                        >
                          {compareIds.includes(p.id) ? <Check size={13} /> : <span>+</span>}对比
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>没有匹配的配件</h3>
                  <button
                    onClick={() => {
                      setBrand('all');
                      setQuery('');
                      setStatus('all');
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </section>
            {compare.length > 0 && (
              <section id="parts-comparison" className="parts-compare" aria-label="配件对比">
                <div>
                  <span className="eyebrow">SIDE BY SIDE / {compare.length} OF 3</span>
                  <h2>把差异，放在一起看。</h2>
                  <button onClick={() => setCompareIds([])}>
                    清空对比 <X size={15} />
                  </button>
                </div>
                <p>最多对比同一品类的三款产品。重量只在相同版本、尺寸及称重口径下可直接比较。</p>
                <div className="compare-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>参数</th>
                        {compare.map((p) => (
                          <th key={p.id}>
                            {p.name}
                            <button
                              aria-label={`移除对比 ${p.name}`}
                              onClick={() =>
                                setCompareIds((ids) => ids.filter((id) => id !== p.id))
                              }
                            >
                              <X size={13} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(compare.flatMap((p) => p.specs.map((s) => s[0])))).map(
                        (key) => (
                          <tr key={key}>
                            <th>{key}</th>
                            {compare.map((p) => (
                              <td key={p.id}>{p.specs.find((s) => s[0] === key)?.[1] || '—'}</td>
                            ))}
                          </tr>
                        ),
                      )}
                      <tr>
                        <th>适用场景与取舍</th>
                        {compare.map((p) => (
                          <td key={p.id}>{p.tradeoff}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <p className="parts-footnote">
              参数来自厂商产品页与技术文档。性能特点按设计用途整理，不以不同测试条件下的宣传数字作统一排名。图片版权归各厂商所有。
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function PartDrawing({ category }: { category: PartCategory }) {
  if (category === 'groupsets')
    return <Cog className="part-line-icon" strokeWidth={0.6} aria-hidden="true" />;
  if (category === 'tires')
    return <CircleDot className="part-line-icon" strokeWidth={0.6} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 360 260" fill="none" aria-hidden="true">
      <g stroke="currentColor">
        <circle cx="180" cy="130" r="111" strokeWidth="1" />
        <circle cx="180" cy="130" r="96" strokeWidth="8" opacity=".3" />
        <circle cx="180" cy="130" r="9" strokeWidth="4" />
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i * Math.PI) / 10;
          return (
            <path
              key={i}
              d={`M ${180 + Math.cos(a) * 9} ${130 + Math.sin(a) * 9} L ${180 + Math.cos(a + 0.19) * 91} ${130 + Math.sin(a + 0.19) * 91}`}
              strokeWidth=".8"
            />
          );
        })}
        <path d="M 46 13 h 23 M 46 13 v 23 M 314 247 h -23 M 314 247 v -23" opacity=".5" />
      </g>
    </svg>
  );
}
