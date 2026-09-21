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
  ZoomIn,
  X,
} from 'lucide-react';
import type { Bike, Catalog, Collection } from './types';
import { imageUrl, loadCatalog } from './catalog';
import { paintsForBike } from './bikePaints';

import Engineering from './Engineering';
import modelProfiles from './data/model-profiles.json';
import BikeCard from './BikeCard';
import { filterBikes, groupBikes } from './catalogBrowse';
import './catalog-browse.css';
import { SiteHeader, SiteFooter, base } from './SiteChrome';
import { CompareButton, CompareDock, SaveButton } from './Library';
import PhotoViewer from './PhotoViewer';
import stories from './data/stories.json';
const Bike3D = lazy(() => import('./Bike3D'));

const collections: { id: Collection; label: string }[] = [
  { id: 'all', label: '全部车型' },
  { id: 'current', label: '在售系列' },
  { id: 'classic', label: '经典存档' },
  { id: 'popular', label: '人气精选' },
  { id: 'pro', label: '职业赛场' },
  { id: 'flagship', label: '高端旗舰' },
];
function App({ browse = false }: { browse?: boolean }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(
    new URLSearchParams(location.search).get('bike') || 'tarmac-sl8',
  );
  const [componentId, setComponentId] = useState(
    new URLSearchParams(location.search).get('part') || 'frame',
  );
  const [photoOpen, setPhotoOpen] = useState(false);
  const [paintId, setPaintId] = useState(
    new URLSearchParams(location.search).get('paint') || 'default',
  );
  const [collection, setCollection] = useState<Collection>('all');
  const [brand, setBrand] = useState('all');
  const [query, setQuery] = useState('');
  const [showPins, setShowPins] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [geometrySize, setGeometrySize] = useState('');
  const [kind, setKind] = useState('all');
  const [year, setYear] = useState('all');
  const [groupMode, setGroupMode] = useState<'brand' | 'year'>('brand');
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const workbench = useRef<HTMLDivElement>(null);
  const currentSearch = useRef(location.search);
  const load = () => {
    setError('');
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError('暂时无法加载车型库，请稍后重试。'));
  };
  useEffect(load, []);
  useEffect(() => {
    const onBack = () => {
      if (currentSearch.current === location.search) return;
      currentSearch.current = location.search;
      setSelectedId(new URLSearchParams(location.search).get('bike') || 'tarmac-sl8');
      setPaintId(new URLSearchParams(location.search).get('paint') || 'default');
      setIs3D(false);
      setGeometrySize('');
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);
  const bike = catalog?.bikes.find((b) => b.id === selectedId) || catalog?.bikes[0];
  const paints = bike ? paintsForBike(bike) : [];
  const paint = paints.find((p) => p.id === paintId) || paints[0];
  const geometry =
    bike?.geometry.sizes.find((g) => g.size === geometrySize) ||
    bike?.geometry.sizes.find((g) => g.size === bike.geometry.defaultSize) ||
    bike?.geometry.sizes[0];
  const component = bike?.components.find((c) => c.id === componentId) || bike?.components[0];
  useEffect(() => {
    if (bike) document.title = `${browse ? '整车图鉴' : bike.family} · VÉLODEX 公路车图鉴`;
  }, [bike, browse]);
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
      if (e.key !== 'Tab' || document.querySelector('dialog[open]')) return;
      const buttons = Array.from(
        panel?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ||
          [],
      ).filter((element) => element.getClientRects().length > 0);
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
    setIs3D(false);
    setGeometrySize('');
    setComponentId('frame');
    setPaintId('default');
    const url = new URL(location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('part');
    url.searchParams.set('bike', item.id);
    url.searchParams.delete('paint');
    history.pushState({}, '', url);
    currentSearch.current = url.search;
    document.getElementById('explorer')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  };
  const selectPaint = (id: string) => {
    setPaintId(id);
    setIs3D(false);
    const url = new URL(location.href);
    url.searchParams.set('bike', bike!.id);
    if (id === 'default') url.searchParams.delete('paint');
    else url.searchParams.set('paint', id);
    history.pushState({}, '', url);
    currentSearch.current = url.search;
  };
  const filtered = catalog
    ? filterBikes(catalog.bikes, catalog.brands, { brand, year, kind, collection, query })
    : [];
  const groups = catalog ? groupBikes(filtered, catalog.brands, groupMode) : [];
  const years = [
    ...new Set(catalog?.bikes.map((b) => b.modelYear).filter((y): y is number => y != null)),
  ].sort((a, b) => b - a);
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
      <a className="skip-link" href={browse ? '#collection' : '#explorer'}>
        跳转到图鉴内容
      </a>
      <SiteHeader active="bikes" />
      <main>
        {!catalog || !bike || !component || !paint ? (
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
            {!browse && (
              <>
                <nav className="detail-nav" aria-label="车型章节">
                  <a href={`${base}?view=bikes`}>
                    <ArrowLeft size={14} />
                    全部车型
                  </a>
                  <div>
                    <a href="#explorer">外观与部件</a>
                    <a href="#engineering">几何与风阻</a>
                    <a href="#bike-reading">延伸阅读</a>
                  </div>
                </nav>
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
                  <div className="detail-actions">
                    <SaveButton bike={bike} paintId={paint.id} />
                    <CompareButton bike={bike} />
                    <a
                      className="quiet-action"
                      href={`${base}?view=workshop&tool=build&platform=${bike.id}&paint=${paint.id}`}
                    >
                      用这台车开始装车 <ArrowUpRight size={15} />
                    </a>
                    <a className="quiet-action" href={`${base}?view=compare`}>
                      打开对比台 <ArrowUpRight size={15} />
                    </a>
                  </div>
                  {(bike.race || bike.price) && (
                    <div className="bike-context">
                      {bike.race && (
                        <a
                          href={bike.race.source}
                          target="_blank"
                          rel="noreferrer"
                          title={bike.race.note}
                        >
                          <span>RACE DNA</span>
                          {bike.race.label}
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                      {bike.price && (
                        <a
                          href={bike.price.source}
                          target="_blank"
                          rel="noreferrer"
                          title={`${bike.price.market} · 核对 ${bike.price.checkedAt}，非实时成交价`}
                        >
                          <span>官方参考价</span>
                          {bike.price.label}
                          <small>{bike.price.market}</small>
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                    </div>
                  )}
                  <div
                    ref={workbench}
                    className={`workbench ${expanded ? 'is-expanded' : ''}`}
                    role={expanded ? 'dialog' : undefined}
                    aria-modal={expanded || undefined}
                    aria-label={expanded ? '放大整车探索' : undefined}
                  >
                    <div
                      className={`visual-panel ${paint.imageTone === 'dark' ? 'photo-dark' : ''}`}
                    >
                      {is3D && (
                        <div className="view-mode">
                          <button onClick={() => setIs3D(false)}>返回官方照片</button>
                          <span>近似结构示意 · 实验功能</span>
                        </div>
                      )}
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
                            onClick={() => setPhotoOpen(true)}
                            aria-label="打开官方照片细看"
                          >
                            <ZoomIn size={17} />
                            <span>照片细看</span>
                          </button>
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
                                aspectRatio: paint.imageRatio,
                                '--image-ratio': paint.imageRatio,
                              } as CSSProperties
                            }
                          >
                            <img
                              className="bike-photo"
                              src={imageUrl(paint.image)}
                              style={{ objectPosition: paint.imagePosition }}
                              alt={`${currentBrand?.name} ${bike.name} ${paint.name} 官方整车图片`}
                              key={`${bike.id}-${paint.id}`}
                              fetchPriority="high"
                            />
                            {showPins &&
                              bike.components.map((part, index) =>
                                part.id === 'power' && !bike.hasPowerMeter ? null : (
                                  <button
                                    key={part.id}
                                    className={`hotspot ${component.id === part.id ? 'selected' : ''}`}
                                    style={{
                                      left: `${paint.hotspots?.[part.id]?.x ?? part.x}%`,
                                      top: `${paint.hotspots?.[part.id]?.y ?? part.y}%`,
                                    }}
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
                                ),
                              )}
                          </div>
                        </div>
                      )}
                      {is3D && (
                        <p className="model-note">
                          依据对应车型实拍与车架几何近似重建。管型截面与装配细节为估计，非原厂 CAD。
                        </p>
                      )}
                      <div className="visual-bottom">
                        <div className="paint-selection">
                          <span className="paint-name" aria-live="polite">
                            <i
                              className="paint-dot"
                              style={{ background: is3D ? '#737b82' : paint.hex }}
                            />
                            {is3D ? '无涂装 / 中性材质' : paint.name}
                          </span>
                          {paints.length > 1 && (
                            <div
                              className="paint-options paint-thumbnails"
                              role="group"
                              aria-label="选择涂装"
                            >
                              {paints.map((p) => (
                                <button
                                  key={p.id}
                                  title={p.name}
                                  aria-label={`切换涂装：${p.name}`}
                                  aria-pressed={p.id === paint.id && !is3D}
                                  onClick={() => selectPaint(p.id)}
                                >
                                  <img src={imageUrl(p.image)} alt="" loading="lazy" />
                                  <i style={{ background: p.hex }} />
                                  {p.id === paint.id && !is3D && <Check size={12} />}
                                </button>
                              ))}
                              <small>{paints.length} 款涂装</small>
                            </div>
                          )}
                        </div>
                        <span className="view-note">
                          {is3D ? 'INTERACTIVE 3D' : 'OFFICIAL PHOTO'}{' '}
                          <span>{is3D ? '结构视图' : '官方图片'}</span>
                        </span>
                      </div>
                      {paint.note && <p className="image-note">{paint.note}</p>}
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
                      {!!component.catalogIds?.length && (
                        <a
                          className="part-catalog-link"
                          href={`${import.meta.env.BASE_URL}?view=parts&product=${component.catalogIds[0]}`}
                        >
                          探索配件系列档案 <ArrowUpRight size={15} />
                        </a>
                      )}
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
                      <span>{bike.weightLabel || '整车重量'}</span>
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
                      <small>{bike.material.includes('铝') ? '铝合金车架' : '碳纤维车架'}</small>
                    </div>
                  </div>
                </section>
                <Engineering bike={bike} geometry={geometry} onSize={setGeometrySize} />
                {geometry && bike.id in modelProfiles && (
                  <details className="experimental-model">
                    <summary>实验功能 / 近似 3D 结构示意</summary>
                    <p>
                      基于照片与几何的估算轮廓，适合辅助理解结构关系。管型、接点与部件表面不具备细节观察所需的精度。
                    </p>
                    <button
                      className="outline-button"
                      onClick={() => {
                        setIs3D(true);
                        document.getElementById('explorer')?.scrollIntoView({
                          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                            ? 'instant'
                            : 'smooth',
                        });
                      }}
                    >
                      在上方打开结构示意 <ArrowUpRight size={15} />
                    </button>
                  </details>
                )}
                <section id="bike-reading" className="bike-reading">
                  <span className="eyebrow">KEEP EXPLORING</span>
                  <h2>再多看一点。</h2>
                  <div>
                    {stories
                      .filter(
                        (story) =>
                          story.chapters.some((chapter) => chapter.bikeId === bike.id) ||
                          story.compare.includes(bike.id),
                      )
                      .map((story) => (
                        <a key={story.id} href={`${base}?view=stories&story=${story.id}`}>
                          <span>相关专题</span>
                          <strong>{story.title}</strong>
                          <ArrowUpRight size={18} />
                        </a>
                      ))}
                    <a href={`${base}?view=bikes`}>
                      <span>整车图鉴</span>
                      <strong>下一台，换一种性格。</strong>
                      <ArrowUpRight size={18} />
                    </a>
                  </div>
                </section>
              </>
            )}
            {browse && (
              <>
                <header className="page-heading">
                  <span className="eyebrow">
                    THE COLLECTION / {catalog.bikes.length} ROAD MACHINES
                  </span>
                  <h1>各有性格，都值得看。</h1>
                  <p>按品牌与年份整理，再用骑行方式缩小范围。找到让你停留的那台车。</p>
                </header>
                <details
                  className="brand-directory"
                  open={location.hash === '#brands' || undefined}
                >
                  <summary>
                    按品牌浏览 <small>{catalog.brands.length} 个品牌 · 展开索引</small>
                  </summary>
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
                            document
                              .getElementById('collection')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          aria-pressed={brand === item.id}
                          title={`${item.name} · ${item.country}`}
                        >
                          <span>{item.name}</span>
                          <small>
                            {item.country}
                            {item.founded && ` · ${item.founded}`}
                          </small>
                        </button>
                      ))}
                    </div>
                  </section>
                </details>
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
                    {[
                      'all',
                      '气动竞赛',
                      '全能公路',
                      '轻量爬坡',
                      '长途耐力',
                      '砾石公路',
                      'TT 计时',
                    ].map((value) => (
                      <button
                        key={value}
                        aria-pressed={kind === value}
                        onClick={() => setKind(value)}
                      >
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
                          : collection === 'pro'
                            ? '记录职业车队使用的同系平台；此处展示的零售配置不等于某场比赛的车手定制配置。'
                            : collection === 'flagship'
                              ? '品牌高端平台与旗舰配置精选；标价保留官方地区及币种，不作跨市场价格排名。'
                              : '保留经典世代的当年配置，感受公路车设计的演进。'}
                    </p>
                  )}
                  <div className="catalog-order">
                    <div role="group" aria-label="图鉴排列方式">
                      <button
                        aria-pressed={groupMode === 'brand'}
                        onClick={() => setGroupMode('brand')}
                      >
                        按品牌
                      </button>
                      <button
                        aria-pressed={groupMode === 'year'}
                        onClick={() => setGroupMode('year')}
                      >
                        按年份
                      </button>
                    </div>
                    <label>
                      车型年份
                      <select value={year} onChange={(e) => setYear(e.target.value)}>
                        <option value="all">所有年份</option>
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y} 年
                          </option>
                        ))}
                        <option value="unknown">年份未标注</option>
                      </select>
                    </label>
                    <span role="status">
                      {filtered.length} 款车型 · {groups.length} 个分组
                    </span>
                  </div>
                  <p className="catalog-year-note">
                    年份指收录配置的车型年，不代表该车系首次发布的年份。原厂未明确年份的版本单独列出；核对日期不作为车型年。
                  </p>
                  {filtered.length ? (
                    <div className="catalog-groups">
                      <nav className="catalog-jumps" aria-label="跳转到图鉴分组">
                        {groups.map((group) => (
                          <a key={group.id} href={`#catalog-${groupMode}-${group.id}`}>
                            {group.title}
                            <small>{group.bikes.length}</small>
                          </a>
                        ))}
                      </nav>
                      {groups.map((group) => (
                        <section
                          className="catalog-group"
                          key={group.id}
                          id={`catalog-${groupMode}-${group.id}`}
                          aria-label={group.title}
                        >
                          <header>
                            <div>
                              <span className="eyebrow">{group.subtitle}</span>
                              <h2>{group.title}</h2>
                            </div>
                            <span>{String(group.bikes.length).padStart(2, '0')} 款车型</span>
                          </header>
                          <div className="bike-grid">
                            {group.bikes.map((item) => (
                              <BikeCard key={item.id} bike={item} />
                            ))}
                          </div>
                        </section>
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
                          setYear('all');
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
          </>
        )}
      </main>
      <SiteFooter />
      <CompareDock />
      {photoOpen && paint && bike && (
        <PhotoViewer paint={paint} name={bike.family} onClose={() => setPhotoOpen(false)} />
      )}
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
                  {paint?.note ||
                    '图片与参数对应此页面注明的整车版本；配置可能因地区、尺寸和批次而调整。'}
                </p>
                {bike.race && <p>{bike.race.note}</p>}
                {bike.price && (
                  <p>
                    官方参考价 {bike.price.label} · {bike.price.market} · 核对{' '}
                    {bike.price.checkedAt}。价格可能调整，不代表本地售价或实时库存。
                  </p>
                )}
                {paint && (
                  <a href={paint.source} target="_blank" rel="noreferrer">
                    当前涂装原始页面 <ArrowUpRight size={15} />
                  </a>
                )}
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
export default App;
