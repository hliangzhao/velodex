import { useEffect, useRef, useState, lazy, Suspense, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDot,
  Expand,
  Layers3,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { Bike, Catalog, Collection } from './types';
import { imageUrl, loadCatalog } from './catalog';

import Engineering from './Engineering';
const Bike3D = lazy(() => import('./Bike3D'));

const collections: { id: Collection; label: string }[] = [
  { id: 'all', label: '全部车型' },
  { id: 'current', label: '在售系列' },
  { id: 'classic', label: '经典存档' },
  { id: 'popular', label: '人气精选' },
];
function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(
    new URLSearchParams(location.search).get('bike') || 'tarmac-sl8',
  );
  const [componentId, setComponentId] = useState('frame');
  const [collection, setCollection] = useState<Collection>('all');
  const [brand, setBrand] = useState('all');
  const [query, setQuery] = useState('');
  const [showPins, setShowPins] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [geometrySize, setGeometrySize] = useState('');
  const [kind, setKind] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const workbench = useRef<HTMLDivElement>(null);
  const load = () => {
    setError('');
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError('暂时无法加载车型库，请稍后重试。'));
  };
  useEffect(load, []);
  useEffect(() => {
    const onBack = () =>
      setSelectedId(new URLSearchParams(location.search).get('bike') || 'tarmac-sl8');
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);
  const bike = catalog?.bikes.find((b) => b.id === selectedId) || catalog?.bikes[0];
  const geometry =
    bike?.geometry.sizes.find((g) => g.size === geometrySize) ||
    bike?.geometry.sizes.find((g) => g.size === bike.geometry.defaultSize) ||
    bike?.geometry.sizes[0];
  const component = bike?.components.find((c) => c.id === componentId) || bike?.components[0];
  useEffect(() => {
    if (bike) document.title = `${bike.family} · VÉLODEX 公路车图鉴`;
  }, [bike]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = expanded ? 'hidden' : '';
    return () => {
      document.removeEventListener('keydown', escape);
      document.body.style.overflow = '';
    };
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement;
    const panel = workbench.current;
    panel?.querySelector<HTMLButtonElement>('button[aria-label="退出放大"]')?.focus();
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || dialog.current?.open) return;
      const buttons = Array.from(panel?.querySelectorAll<HTMLButtonElement>('button') || []);
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previous?.focus();
    };
  }, [expanded]);
  const selectBike = (item: Bike) => {
    setSelectedId(item.id);
    setGeometrySize('');
    setComponentId('frame');
    const url = new URL(location.href);
    url.searchParams.set('bike', item.id);
    history.pushState({}, '', url);
    document.getElementById('explorer')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  };
  const filtered =
    catalog?.bikes.filter(
      (b) =>
        (brand === 'all' || b.brandId === brand) &&
        (kind === 'all' || b.kind === kind) &&
        (collection === 'all' || b.collections.includes(collection)) &&
        `${b.name} ${b.brandId} ${catalog.brands.find((item) => item.id === b.brandId)?.name ?? ''} ${b.build}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ) || [];
  const currentBrand = catalog?.brands.find((b) => b.id === bike?.brandId);
  const partIndex = bike?.components.findIndex((c) => c.id === component?.id) || 0;
  const step = (direction: number) => {
    if (!bike || !catalog) return;
    const next =
      (catalog.bikes.indexOf(bike) + direction + catalog.bikes.length) % catalog.bikes.length;
    selectBike(catalog.bikes[next]);
  };
  return (
    <>
      <a className="skip-link" href="#explorer">
        跳转到整车探索
      </a>
      <header className="site-header">
        <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="VÉLODEX 首页">
          <span className="logo-mark">V</span>VÉLODEX
        </a>
        <nav aria-label="主导航">
          <a className="active" href="#explorer">
            整车探索
          </a>
          <a href="#collection">车型图鉴</a>
          <a href="#brands">品牌索引</a>
        </nav>
        <span className="header-caption">
          THE ROAD BIKE INDEX<span>为热爱，拆解每一处细节。</span>
        </span>
      </header>
      <main>
        {!catalog || !bike || !component ? (
          <div className="load-state" role="status">
            <span className="eyebrow">VÉLODEX / ROAD MACHINES</span>
            <h1>{error || '正在打开公路车图鉴…'}</h1>
            {error && (
              <button className="dark-button" onClick={load}>
                重新连接 <ArrowRight size={18} />
              </button>
            )}
          </div>
        ) : (
          <>
            <section id="explorer" className="explorer" aria-label="交互式整车探索">
              <div className="section-overline">
                <span>
                  <i /> THE COLLECTION / 公路车图鉴
                </span>
                <span className="index-count">
                  {String(catalog.bikes.indexOf(bike) + 1).padStart(2, '0')}{' '}
                  <span>/ {String(catalog.bikes.length).padStart(2, '0')}</span>
                </span>
              </div>
              <div className="bike-heading">
                <div>
                  <div className="bike-kicker">
                    <span>{currentBrand?.name}</span>
                    <span className="edition">{bike.edition}</span>
                    <span className="kind">{bike.kind}</span>
                  </div>
                  <h1>{bike.family}</h1>
                  <p className="build-name">
                    {bike.build}
                    <span className="build-dot">/</span>
                    {bike.name}
                  </p>
                </div>
                <div className="model-switch">
                  <button onClick={() => step(-1)} aria-label="上一款车型">
                    <ArrowLeft size={20} />
                  </button>
                  <button onClick={() => step(1)} aria-label="下一款车型">
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
              <div
                ref={workbench}
                className={`workbench ${expanded ? 'is-expanded' : ''}`}
                role={expanded ? 'dialog' : undefined}
                aria-modal={expanded || undefined}
                aria-label={expanded ? '放大整车探索' : undefined}
              >
                <div className={`visual-panel ${bike.imageTone === 'dark' ? 'photo-dark' : ''}`}>
                  <div className="view-mode">
                    <button aria-pressed={!is3D} onClick={() => setIs3D(false)}>
                      整车实拍
                    </button>
                    <button aria-pressed={is3D} onClick={() => setIs3D(true)}>
                      车型 3D
                    </button>
                  </div>
                  <div className="visual-toolbar">
                    <span>
                      <CircleDot size={15} />{' '}
                      {is3D
                        ? '拖拽旋转，点击部件'
                        : showPins
                          ? '点击热点，探索部件'
                          : '整车欣赏模式'}
                    </span>
                    <div>
                      <button
                        disabled={is3D}
                        className={showPins ? 'pressed' : ''}
                        aria-label={showPins ? '隐藏部件热点' : '显示部件热点'}
                        aria-pressed={showPins}
                        onClick={() => setShowPins(!showPins)}
                      >
                        <Layers3 size={17} />
                        <span>热点</span>
                      </button>
                      <button
                        onClick={() => setExpanded(!expanded)}
                        aria-label={expanded ? '退出放大' : '放大整车'}
                      >
                        {expanded ? <X size={18} /> : <Expand size={17} />}
                      </button>
                    </div>
                  </div>
                  {is3D && geometry ? (
                    <Suspense fallback={<div className="three-loading">正在加载 3D 视图…</div>}>
                      <Bike3D
                        bike={bike}
                        geometry={geometry}
                        selected={componentId}
                        onSelect={setComponentId}
                      />
                    </Suspense>
                  ) : (
                    <div className="bike-stage">
                      <div
                        className="bike-canvas"
                        style={
                          {
                            aspectRatio: bike.imageRatio,
                            '--image-ratio': bike.imageRatio,
                          } as CSSProperties
                        }
                      >
                        <img
                          className="bike-photo"
                          src={imageUrl(bike.image)}
                          style={{ objectPosition: bike.imagePosition }}
                          alt={`${currentBrand?.name} ${bike.name} ${bike.color} 传动侧整车实拍`}
                          key={bike.id}
                          fetchPriority="high"
                        />
                        {showPins &&
                          bike.components.map((part, index) => (
                            <button
                              key={part.id}
                              className={`hotspot ${component.id === part.id ? 'selected' : ''}`}
                              style={{ left: `${part.x}%`, top: `${part.y}%` }}
                              onClick={() => setComponentId(part.id)}
                              aria-label={`查看${part.name}参数`}
                              aria-pressed={component.id === part.id}
                            >
                              <span className="pin-core">
                                {component.id === part.id ? (
                                  <Minus size={12} />
                                ) : (
                                  <Plus size={12} />
                                )}
                              </span>
                              <span className="pin-label">
                                {part.name}
                                <small>{String(index + 1).padStart(2, '0')}</small>
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {is3D && (
                    <p className="model-note">
                      依据对应车型实拍与车架几何近似重建。管型截面与装配细节为估计，非原厂 CAD。
                    </p>
                  )}
                  <div className="visual-bottom">
                    <span>
                      <i className="paint-dot" style={{ background: bike.colorHex }} />
                      {is3D ? '无涂装 / 中性材质' : bike.color}
                    </span>
                    <span className="view-note">
                      DRIVE SIDE <span>传动侧</span>
                    </span>
                  </div>
                  {bike.imageNote && <p className="image-note">{bike.imageNote}</p>}
                </div>
                <aside className="component-panel" aria-label="部件参数" aria-live="polite">
                  <div className="part-topline">
                    <span>部件档案</span>
                    <span>
                      {String(partIndex + 1).padStart(2, '0')} /{' '}
                      {String(bike.components.length).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="component-heading">
                    <div>
                      <span className="part-english">{component.english}</span>
                      <h2>{component.name}</h2>
                    </div>
                    <span className="component-symbol">
                      <Plus size={26} strokeWidth={1} />
                    </span>
                  </div>
                  <div className="part-detail" key={`${bike.id}-${component.id}`}>
                    <h3>{component.title}</h3>
                    <p>{component.description}</p>
                    <dl>
                      {component.specs.map(([name, value]) => (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <button className="all-specs" onClick={() => dialog.current?.showModal()}>
                    查看完整配置 <ArrowUpRight size={18} />
                  </button>
                </aside>
              </div>
              <div className="component-selector" aria-label="部件选择">
                {bike.components.map((part, i) => (
                  <button
                    className={component.id === part.id ? 'active' : ''}
                    key={part.id}
                    onClick={() => setComponentId(part.id)}
                    aria-pressed={component.id === part.id}
                  >
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {part.name}
                    {component.id === part.id && <i />}
                  </button>
                ))}
              </div>
              <div className="bike-summary">
                <div className="summary-description">
                  <span className="eyebrow">BUILT FOR THE ROAD</span>
                  <p>{bike.description}</p>
                </div>
                <div className="summary-stat">
                  <span>整车重量</span>
                  <strong>{bike.weight}</strong>
                  <small>{bike.weightNote}</small>
                </div>
                <div className="summary-stat">
                  <span>变速系统</span>
                  <strong>{bike.groupset}</strong>
                  <small>所展示整车配置</small>
                </div>
                <div className="summary-stat">
                  <span>车架材质</span>
                  <strong>{bike.material}</strong>
                  <small>碳纤维车架</small>
                </div>
              </div>
            </section>
            {geometry && <Engineering bike={bike} geometry={geometry} onSize={setGeometrySize} />}
            <section id="brands" className="brand-section" aria-label="品牌索引">
              <div className="brand-intro">
                <span className="eyebrow">THE MAKERS</span>
                <h2>不同基因，同样热爱。</h2>
              </div>
              <div className="brand-list">
                {catalog.brands.map((item) => (
                  <button
                    key={item.id}
                    className={`brand-word ${brand === item.id ? 'selected' : ''} brand-${item.id}`}
                    onClick={() => {
                      setBrand(brand === item.id ? 'all' : item.id);
                      document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    aria-pressed={brand === item.id}
                    title={`${item.name} · ${item.country}`}
                  >
                    <span>{item.name}</span>
                    <small>
                      {item.country} · {item.founded}
                    </small>
                  </button>
                ))}
              </div>
            </section>
            <section id="collection" className="collection-section">
              <div className="collection-heading">
                <div>
                  <span className="eyebrow">FIND YOUR NEXT OBSESSION</span>
                  <h2>
                    公路，千种可能<span>({String(filtered.length).padStart(2, '0')})</span>
                  </h2>
                </div>
                <label className="search">
                  <Search size={18} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索品牌、车型"
                    aria-label="搜索品牌或车型"
                  />
                </label>
              </div>
              <div className="kind-filters" aria-label="车型定位">
                {['all', '气动竞赛', '全能公路', '轻量爬坡', '长途耐力'].map((value) => (
                  <button key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
                    {value === 'all' ? '全部定位' : value}
                  </button>
                ))}
              </div>
              <div className="collection-filters">
                <div className="collection-tabs" aria-label="车型分类">
                  {collections.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCollection(item.id)}
                      className={collection === item.id ? 'active' : ''}
                      aria-pressed={collection === item.id}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="brand-select">
                  <span className="sr-only">筛选品牌</span>
                  <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="all">所有品牌</option>
                    {catalog.brands.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {collection !== 'all' && (
                <p className="collection-note">
                  {collection === 'popular'
                    ? catalog.collectionNote
                    : collection === 'current'
                      ? '在售系列指官方地区网站仍有产品展示，不代表实时库存或中国大陆供货。'
                      : '保留经典世代的当年配置，感受公路车设计的演进。'}
                </p>
              )}
              {filtered.length ? (
                <div className="bike-grid">
                  {filtered.map((item, index) => (
                    <BikeCard
                      key={item.id}
                      bike={item}
                      index={index}
                      selected={item.id === bike.id}
                      onSelect={() => selectBike(item)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>还没有找到这款车</h3>
                  <p>试试其他车型名称，或查看完整图鉴。</p>
                  <button
                    onClick={() => {
                      setQuery('');
                      setBrand('all');
                      setKind('all');
                      setCollection('all');
                    }}
                  >
                    清除筛选 <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="catalog-note">
                <Check size={15} />
                <span>
                  配置依据品牌官方资料整理，按所注明的年份与地区版本展示。图片版权归各品牌所有。
                </span>
                <span>资料核对 / {catalog.updatedAt}</span>
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <a className="wordmark" href="#">
          VÉLODEX
        </a>
        <span>献给每一个忍不住回头看车的人。</span>
        <a href="#explorer">
          回到整车探索 <ArrowUpRight size={16} />
        </a>
      </footer>
      <dialog
        ref={dialog}
        className="spec-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        {bike && (
          <>
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">TECHNICAL SPECIFICATIONS</span>
                <h2>{bike.family}</h2>
                <p>
                  {bike.edition} · {bike.build}
                </p>
              </div>
              <button onClick={() => dialog.current?.close()} aria-label="关闭完整配置">
                <X size={24} />
              </button>
            </div>
            <div className="dialog-body">
              {bike.components.map((part) => (
                <section key={part.id}>
                  <h3>
                    {part.name}
                    <span>{part.english}</span>
                  </h3>
                  <strong>{part.title}</strong>
                  <dl>
                    {part.specs.map(([name, value]) => (
                      <div key={name}>
                        <dt>{name}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              <div className="source-note">
                <h3>资料与图片来源</h3>
                <p>
                  {bike.imageNote ||
                    '图片与参数对应此页面注明的整车版本；配置可能因地区、尺寸和批次而调整。'}
                </p>
                <p>
                  图片：{bike.imageCredit} · 核对：{bike.checkedAt}
                </p>
                <a href={bike.source} target="_blank" rel="noreferrer">
                  {bike.sourceLabel} <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
function BikeCard({
  bike,
  index,
  selected,
  onSelect,
}: {
  bike: Bike;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`bike-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-label={`探索 ${bike.name}`}
      aria-pressed={selected}
    >
      <div className="card-top">
        <span>{bike.brandId.toUpperCase()}</span>
        <span>{bike.collections.includes('classic') ? 'CLASSIC' : bike.kind}</span>
      </div>
      <div className="card-image">
        <img
          src={imageUrl(bike.image)}
          style={{ objectPosition: bike.imagePosition }}
          alt={bike.name}
          loading="lazy"
        />
      </div>
      <div className="card-bottom">
        <div>
          <h3>{bike.family}</h3>
          <p>{bike.build}</p>
        </div>
        <span className="card-arrow">
          {selected ? <Check size={18} /> : <ArrowUpRight size={18} />}
        </span>
      </div>
      <div className="card-footer">
        <span>{bike.edition}</span>
        <span>{selected ? '正在探索' : `NO. ${String(index + 1).padStart(2, '0')}`}</span>
      </div>
    </button>
  );
}
export default App;
