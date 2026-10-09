import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Plus,
  Share2,
  Trash2,
  Undo2,
  Wrench,
  X,
  Bike,
  Layers3,
  Ruler,
  Bookmark,
  Activity,
  ScanLine,
  ReceiptText,
} from 'lucide-react';
import type { Catalog, PartsCatalog, Product } from '../types';
import { imageUrl, loadCatalog, loadParts } from '../catalog';
import { referencePriceLabel } from '../upgrade-planner';
import { weightReferences } from '../workshop';
import PartsPicker from './PartsPicker';
import PurchaseControls from './PurchaseControls';
import QuoteWorkbench from './QuoteWorkbench';
import SalesFields from './SalesFields';
import { productProfile, frameProfile, salesForItem, salesText } from './sales';
import BudgetWorkbench from './BudgetWorkbench';
import CostBreakdown from './CostBreakdown';
import PhotoButton, { productPhoto } from '../PhotoButton';
import { frames, orderQuestions, quoteText } from './library';
import { PageFrame, usePageTitle } from '../SiteChrome';
import {
  amount,
  applyPurchaseQuote,
  type PurchaseQuote,
  categories,
  checks,
  customItem,
  decodePlan,
  draftKey,
  encodePlan,
  estimate,
  label,
  money,
  newPlan,
  parsePlan,
  planText,
  productItem,
  selectBike,
  shelfKey,
  unitPrice,
  wheelDepths,
  type Category,
  type Plan,
  type PlanItem,
  type SavedPlan,
} from './model';
import VisualBuild from './VisualBuild';
import FitTransfer from './FitTransfer';
import { poster } from './poster';
import './studio.css';

export type StudioTab = 'build' | 'parts' | 'quotes' | 'fit' | 'plans';
const base = import.meta.env.BASE_URL;
function read(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
export async function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export default function StudioPage() {
  usePageTitle('装车与升级');
  const [data, setData] = useState<{ catalog: Catalog; parts: PartsCatalog }>(),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(false);
    Promise.all([loadCatalog(), loadParts()])
      .then(([catalog, parts]) => {
        if (alive) setData({ catalog, parts });
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  return (
    <PageFrame active="studio" dock={false}>
      {data ? (
        <Studio {...data} />
      ) : (
        <div className="load-state" role="status">
          {error ? (
            <>
              <p>选配资料暂时无法读取</p>
              <button onClick={() => setAttempt(attempt + 1)}>重试</button>
            </>
          ) : (
            '正在准备装车台…'
          )}
        </div>
      )}
    </PageFrame>
  );
}
export function Studio({
  catalog,
  parts,
  brand = 'VÉLODEX',
  publicRoot,
  exportFile = download,
  incoming,
  onImported,
  legacy,
}: {
  catalog: Catalog;
  parts: PartsCatalog;
  brand?: string;
  publicRoot?: string;
  exportFile?: (blob: Blob, name: string) => Promise<void>;
  incoming?: unknown;
  onImported?: () => void;
  legacy?: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(() => parsePlan(read(draftKey)) || newPlan());
  const [tab, setTab] = useState<StudioTab>(() =>
    ['parts', 'quotes', 'fit', 'plans'].includes(
      new URLSearchParams(location.search).get('section') || '',
    )
      ? (new URLSearchParams(location.search).get('section') as StudioTab)
      : 'build',
  );
  const [shelf, setShelf] = useState<SavedPlan[]>(() => {
    const r = read(shelfKey);
    return Array.isArray(r)
      ? r.slice(0, 30).flatMap((s) => {
          const p = parsePlan(s?.plan);
          return p && typeof s.id === 'string' && typeof s.date === 'string'
            ? [{ id: s.id, date: s.date, plan: p }]
            : [];
        })
      : [];
  });
  const [edited, setEdited] = useState(false),
    [status, setStatus] = useState('方案仅保存在本机'),
    [undo, setUndo] = useState<Plan | null>(null);
  const [category, setCategory] = useState<Category>('wheels'),
    [bikeQuery, setBikeQuery] = useState('');
  const [detail, setDetail] = useState<Product | null>(null),
    [compare, setCompare] = useState<SavedPlan | null>(null),
    [pending, setPending] = useState<Plan | null>(null),
    [link, setLink] = useState('');
  const [busy, setBusy] = useState(false),
    [removed, setRemoved] = useState<SavedPlan | null>(null);
  const file = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const costDialog = useRef<HTMLDialogElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = navigation.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element
        .closest<HTMLElement>('.studio')
        ?.style.setProperty('--st-dock-height', `${element.getBoundingClientRect().height}px`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const editCosts = () => {
    costDialog.current?.close();
    setTab('build');
    requestAnimationFrame(() => {
      const section = document.querySelector<HTMLDetailsElement>('.st-cost-settings');
      if (section) {
        section.open = true;
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };
  const handledRequest = useRef('');
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  const bike = catalog.bikes.find((b) => b.id === plan.bikeId),
    total = estimate(plan),
    advice = checks(plan, parts);
  const valid = !!parsePlan(plan);
  const change = (next: Plan) => {
    if (next.items.length > 60) {
      setStatus('每份方案最多保存 60 项零件，请先移除不需要的项目');
      return;
    }
    setUndo(plan);
    setPlan(next);
    setEdited(true);
    setLink('');
  };
  const add = (p: Product, quote?: PurchaseQuote) => {
    const item = applyPurchaseQuote(productItem(p), quote);
    const ref = weightReferences[p.id];
    if (ref?.length === 1) {
      item.weight = String(ref[0].grams / (p.category === 'tires' ? 2 : 1));
      item.weightScope = ref[0].note;
      item.variant = [item.variant, ref[0].label.replace('两条', '单条计重')]
        .filter(Boolean)
        .join(' · ');
    }
    change({
      ...plan,
      items: [...plan.items, item],
      visual: { ...plan.visual, ...(wheelDepths(p) || {}) },
    });
    setStatus(`已加入 ${p.name}`);
    setDetail(null);
  };
  const itemChange = (key: string, value: Partial<PlanItem>) =>
    change({ ...plan, items: plan.items.map((i) => (i.key === key ? { ...i, ...value } : i)) });
  useEffect(() => {
    if (!edited) return;
    if (!valid) {
      setStatus('数值格式无效，修正后自动保存');
      return;
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(plan));
      setStatus('草稿已保存在本机');
    } catch {
      setStatus('本机保存失败，请导出方案备份');
    }
  }, [plan, edited, valid]);
  useEffect(() => {
    const receive = () => {
      const key = location.search + location.hash;
      if (key === handledRequest.current) return;
      handledRequest.current = key;
      const hash = location.hash;
      if (hash.startsWith('#plan=')) {
        const shared = decodePlan(hash.slice(6));
        if (shared) setPending(shared);
        else setStatus('分享内容无法读取，本机草稿仍保留');
      }
      const params = new URLSearchParams(location.search),
        chosen = catalog.bikes.find((b) => b.id === params.get('useBike')),
        product = parts.products.find((p) => p.id === params.get('addProduct'));
      if (chosen) setPending({ ...selectBike(plan, chosen), paintId: params.get('paint') || '' });
      if (product) setDetail(product);
    };
    receive();
    window.addEventListener('popstate', receive);
    window.addEventListener('hashchange', receive);
    window.addEventListener('velodex:mobile-navigation', receive);
    return () => {
      window.removeEventListener('popstate', receive);
      window.removeEventListener('hashchange', receive);
      window.removeEventListener('velodex:mobile-navigation', receive);
    };
  }, [plan, catalog, parts]);
  useEffect(() => {
    if (incoming === undefined) return;
    const p = parsePlan(incoming);
    if (p) setPending(p);
    else setStatus('文件格式无效，未覆盖当前方案');
    onImported?.();
  }, [incoming]);
  useEffect(() => {
    if (detail || compare || pending || link) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [detail, compare, pending, link]);
  const close = () => {
    setDetail(null);
    setCompare(null);
    setPending(null);
    setLink('');
  };
  const writeShelf = (next: SavedPlan[]) => {
    try {
      localStorage.setItem(shelfKey, JSON.stringify(next));
      setShelf(next);
      return true;
    } catch {
      setStatus('方案架保存失败，请导出备份');
      return false;
    }
  };
  const save = () => {
    if (!valid) return;
    if (shelf.some((s) => JSON.stringify(s.plan) === JSON.stringify(plan))) {
      setStatus('这份方案已经保存');
      return;
    }
    if (shelf.length >= 30) {
      setStatus('方案架已满，请先导出或移除旧方案');
      return;
    }
    if (
      writeShelf([
        { id: crypto.randomUUID(), date: new Date().toISOString(), plan: structuredClone(plan) },
        ...shelf,
      ])
    )
      setStatus('已保存独立方案，可继续修改并对比');
  };
  const exportPlan = () =>
    exportFile(
      new Blob([JSON.stringify({ format: 'velodex-plan', version: 1, plan }, null, 2)], {
        type: 'application/json',
      }),
      '装车方案.velodex',
    ).catch(() => setStatus('导出未完成，请重试'));
  const share = () => {
    const url = new URL(publicRoot || base, location.origin);
    url.search = '?view=studio';
    url.hash = 'plan=' + encodePlan(plan);
    setLink(url.href);
  };
  const makePoster = async () => {
    setBusy(true);
    try {
      await exportFile(await poster(plan, bike, brand), '我的装车方案.png');
      setStatus('海报已生成');
    } catch {
      setStatus('海报生成或分享未完成，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="studio" data-tab={tab}>
      <header className="st-heading">
        <div>
          <span className="st-kicker">{brand} / 装车与升级</span>
          <h1>你的装车工作台</h1>
          <p>从现车升级到整车选配，比较外观、费用和安装条件。</p>
        </div>
        <div className="st-heading-actions">
          <button onClick={() => setPending(newPlan('upgrade'))}>
            <Plus size={16} />
            升级现车
          </button>
          <button onClick={() => setPending(newPlan('build'))}>
            <Bike size={16} />
            从零装车
          </button>
        </div>
      </header>
      <div className="st-navigation" ref={navigation}>
        {tab !== 'quotes' && (
          <div className="st-mobile-budget" aria-label="当前选配费用">
            <button onClick={() => costDialog.current?.showModal()} aria-label="查看费用明细">
              <small>{total.priceComplete ? '净支出估算' : '已知净支出'} · 查看明细</small>
              <strong>{money(total.net)}</strong>
            </button>
            <button
              className="st-primary"
              onClick={() => {
                setTab(tab === 'parts' ? 'build' : 'parts');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {tab === 'parts' ? '查看清单' : '继续选配'} <ArrowRight size={16} />
            </button>
          </div>
        )}
        <nav className="st-tabs" aria-label="装车工作区">
          {(
            [
              ['build', '装车台', Wrench],
              ['parts', '选配件', Layers3],
              ['quotes', '比报价', ReceiptText],
              ['plans', '我的方案', Bookmark],
            ] as const
          ).map(([id, name, Icon]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={19} />
              {name}
              {id === 'plans' && shelf.length > 0 && <small>{shelf.length}</small>}
            </button>
          ))}
        </nav>
      </div>
      <div className="st-status" role="status">
        <span>
          <i />
          {status}
        </span>
        {undo && (
          <button
            onClick={() => {
              setPlan(undo);
              setUndo(null);
              setEdited(true);
            }}
          >
            <Undo2 size={14} />
            撤销上一步
          </button>
        )}
      </div>
      <div className="st-workspace">
        <div className="st-main">
          {tab === 'build' && (
            <>
              <div className="st-workbench-links">
                <a href={`${base}?view=workshop&tool=power`}>
                  <Activity size={19} />
                  <span>
                    <strong>骑行分析与训练</strong>
                    <small>读懂功率，安排下一次骑行</small>
                  </span>
                  <ArrowRight size={15} />
                </a>
                <a href={`${base}?view=compare`}>
                  <ScanLine size={19} />
                  <span>
                    <strong>外观与几何对比</strong>
                    <small>查看大图，比较车型尺寸</small>
                  </span>
                  <ArrowRight size={15} />
                </a>
              </div>
              <BudgetWorkbench plan={plan} parts={parts} change={change} detail={setDetail} />
              <div className="st-inline-actions st-workspace-tools">
                <button onClick={() => setTab('fit')}>
                  <Ruler size={18} />
                  几何与把位
                </button>
                <button onClick={() => setTab('quotes')}>
                  <ReceiptText size={18} />
                  记录与比较商家报价
                </button>
              </div>
              <section className="st-panel st-platform">
                <details className="st-platform-editor">
                  <summary>
                    <div>
                      <span>{plan.mode === 'upgrade' ? '升级现车' : '从零装车'}</span>
                      <h2>{plan.bikeName || '选择车辆或填写车架'}</h2>
                      <small>
                        {plan.size || '不限品牌与车型'} · {plan.title}
                      </small>
                    </div>
                    <span className="st-edit-label">编辑</span>
                  </summary>
                  <div className="st-section-title">
                    <h2>{plan.mode === 'upgrade' ? '你的现车' : '车架与参考外观'}</h2>
                    <span>{plan.mode === 'upgrade' ? '升级方案' : '自由装车'}</span>
                  </div>
                  <label>
                    方案名称
                    <input
                      value={plan.title}
                      maxLength={80}
                      onChange={(e) => change({ ...plan, title: e.target.value })}
                    />
                  </label>
                  <div className="st-fields">
                    <label>
                      查找车型
                      <input
                        type="search"
                        value={bikeQuery}
                        onChange={(e) => setBikeQuery(e.target.value)}
                        placeholder="品牌、型号、年份"
                      />
                    </label>
                    <label>
                      从车型库选择
                      <select
                        value={plan.bikeId}
                        onChange={(e) => {
                          const b = catalog.bikes.find((b) => b.id === e.target.value);
                          if (plan.bikeId === e.target.value) return;
                          setPending(selectBike(plan, b));
                        }}
                      >
                        <option value="">自行填写 / 不指定车型</option>
                        {catalog.bikes
                          .filter(
                            (b) =>
                              b.id === plan.bikeId ||
                              !bikeQuery ||
                              `${b.name} ${b.edition} ${b.modelYear} ${catalog.brands.find((x) => x.id === b.brandId)?.name}`
                                .toLowerCase()
                                .includes(bikeQuery.toLowerCase()),
                          )
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} · {b.modelYear || b.edition}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="st-fields">
                    <label>
                      车辆 / 车架名称
                      <input
                        value={plan.bikeName}
                        maxLength={200}
                        placeholder="也可以填写未收录的车型"
                        onChange={(e) => change({ ...plan, bikeName: e.target.value })}
                      />
                    </label>
                    <label>
                      实际尺码
                      <input
                        list="st-sizes"
                        value={plan.size}
                        maxLength={30}
                        placeholder="按实车填写"
                        onChange={(e) => change({ ...plan, size: e.target.value })}
                      />
                      <datalist id="st-sizes">
                        {bike?.geometry.sizes.map((g) => (
                          <option key={g.size} value={g.size} />
                        ))}
                      </datalist>
                    </label>
                  </div>
                  {bike && <a href={`${base}?bike=${bike.id}`}>查看该车型规格与几何 ↗</a>}
                </details>
              </section>
              <VisualBuild key={plan.bikeId} plan={plan} bike={bike} change={change} />
              <section className="st-panel">
                <div className="st-section-title">
                  <div>
                    <h2>装车清单</h2>
                    <p>把新件、沿用件与拆下的旧件分开，费用与重量会随之更新。</p>
                  </div>
                  <button onClick={() => setTab('parts')}>
                    <Plus size={16} />
                    选配件
                  </button>
                </div>
                {!plan.items.length && (
                  <div className="st-empty">
                    <Layers3 size={30} />
                    <h3>先选择你想更换的零件</h3>
                    <p>无需填写所有参数，就能开始比较价格。未收录的零件可自行添加。</p>
                    <button className="st-primary" onClick={() => setTab('parts')}>
                      打开配件库 <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                <div className="st-items">
                  {plan.items.map((i) => (
                    <article className="st-item" key={i.key}>
                      <div className="st-item-heading">
                        <span>{label(i.category)}</span>
                        <select
                          aria-label={`${i.name || label(i.category)}用途`}
                          value={i.action}
                          onChange={(e) =>
                            itemChange(i.key, { action: e.target.value as PlanItem['action'] })
                          }
                        >
                          <option value="buy">购入</option>
                          <option value="keep">沿用</option>
                          <option value="remove">拆下</option>
                        </select>
                        <button
                          className="st-icon"
                          aria-label={`移除${i.name || label(i.category)}`}
                          onClick={() =>
                            change({ ...plan, items: plan.items.filter((x) => x.key !== i.key) })
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <div className="st-line-summary">
                        <h3>{i.name || '自定义零件'}</h3>
                        <p>{i.variant || label(i.category)}</p>
                        {i.sales && <p className="st-fine">{salesText(i.sales)}</p>}
                        <strong>
                          {i.action === 'buy'
                            ? unitPrice(i) === null
                              ? '填写到手价'
                              : `${money(unitPrice(i)! * i.quantity)} · ${i.quantity} 件`
                            : i.action === 'keep'
                              ? '本次沿用'
                              : '拆下转售'}
                        </strong>
                      </div>
                      <details className="st-line-editor">
                        <summary>编辑规格与报价</summary>
                        {(() => {
                          const p = parts.products.find((p) => p.id === i.productId);
                          const f = frames.find(
                            (f) =>
                              f.id === i.sales?.profileId ||
                              (f.source === i.source && f.name === i.name),
                          );
                          const profile = p ? productProfile(p) : f ? frameProfile(f) : undefined;
                          return (
                            <SalesFields
                              category={i.category}
                              profile={profile}
                              value={salesForItem(i, profile)}
                              change={(sales) => itemChange(i.key, { sales })}
                            />
                          );
                        })()}
                        <label>
                          型号
                          <input
                            value={i.name}
                            maxLength={200}
                            placeholder="填写具体型号"
                            onChange={(e) => itemChange(i.key, { name: e.target.value })}
                          />
                        </label>
                        <div className="st-fields">
                          <label>
                            销售规格 / 版本
                            <input
                              value={i.variant}
                              maxLength={400}
                              placeholder="尺码、塔基、年份、销售地区等"
                              onChange={(e) => itemChange(i.key, { variant: e.target.value })}
                            />
                          </label>
                          <label>
                            数量
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={i.quantity}
                              onChange={(e) => {
                                if (
                                  Number.isInteger(+e.target.value) &&
                                  +e.target.value >= 1 &&
                                  +e.target.value <= 20
                                )
                                  itemChange(i.key, { quantity: +e.target.value });
                              }}
                            />
                          </label>
                        </div>
                        {i.reference && (
                          <div className="st-price-source">
                            <b>{referencePriceLabel(i.reference)}</b>
                            <span>
                              {i.reference.scope} · {i.reference.checkedAt}
                            </span>
                            <a href={i.reference.source} target="_blank" rel="noreferrer">
                              价格来源 ↗
                            </a>
                            {i.reference.currency !== 'CNY' && (
                              <p>海外参考价不直接计入人民币预算，可填写自己的到手单价。</p>
                            )}
                          </div>
                        )}
                        {i.action === 'buy' && (
                          <NumberField
                            label="人民币到手单价 / 元"
                            value={i.price}
                            placeholder={
                              i.reference?.currency === 'CNY'
                                ? `默认采用参考价 ${i.reference.amount}`
                                : '自行填写报价'
                            }
                            set={(price) => itemChange(i.key, { price })}
                          />
                        )}
                        <details>
                          <summary>重量、称量范围与资料</summary>
                          {(weightReferences[i.productId]?.length || 0) > 1 && (
                            <label>
                              采用已收录重量
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const r = weightReferences[i.productId]?.find(
                                    (r) => r.id === e.target.value,
                                  );
                                  if (r)
                                    itemChange(i.key, {
                                      weight: String(r.grams / (i.category === 'tires' ? 2 : 1)),
                                      weightScope: r.note,
                                    });
                                }}
                              >
                                <option value="">选择具体版本后填入</option>
                                {weightReferences[i.productId].map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.label} · {r.grams} g
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <NumberField
                            label={`每个销售单位重量 / g${i.category === 'tires' ? '（单条）' : ''}`}
                            value={i.weight}
                            placeholder="可跳过，不影响选配估价"
                            set={(weight) => itemChange(i.key, { weight })}
                          />
                          <label>
                            称重范围
                            <input
                              value={i.weightScope}
                              maxLength={500}
                              onChange={(e) => itemChange(i.key, { weightScope: e.target.value })}
                              placeholder="例如整对轮组，不含胎垫与气嘴"
                            />
                          </label>
                          <label className="st-checkbox">
                            <input
                              type="checkbox"
                              checked={i.onBike}
                              onChange={(e) => itemChange(i.key, { onBike: e.target.checked })}
                            />
                            计入车上重量（锁鞋、锁片与穿戴设备通常不计）
                          </label>
                          <label>
                            资料链接
                            <input
                              type="url"
                              value={i.source}
                              maxLength={2000}
                              onChange={(e) => itemChange(i.key, { source: e.target.value })}
                              placeholder="https://…"
                            />
                          </label>
                        </details>
                      </details>
                    </article>
                  ))}
                </div>
                <div className="st-inline-actions">
                  <select
                    aria-label="自定义零件类别"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    {categories.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      change({ ...plan, items: [...plan.items, customItem(category)] })
                    }
                  >
                    <Plus size={16} />
                    添加自定义零件
                  </button>
                </div>
              </section>
              <section className="st-panel st-quote">
                <details className="st-settings">
                  <summary>
                    车店询价单 <span>按所选零件列出订购规格与费用范围</span>
                  </summary>
                  <p>把方案交给车店时，除了总价，也请写清各个销售版本和随盒附件。</p>
                  {orderQuestions(plan, parts).map((i) => (
                    <div className="st-order-item" key={i.key}>
                      <h3>{i.name}</h3>
                      <ul>
                        {i.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="st-fine">
                    工时、运费、安装小件与耗材分别报价；套餐内包含的部件不重复计价。若提供整车重量，请写明是否含脚踏、码表与水壶架。
                  </p>
                  <button
                    disabled={!valid || !plan.items.some((i) => i.action === 'buy')}
                    onClick={async () => {
                      try {
                        await exportFile(
                          new Blob([quoteText(plan, parts)], { type: 'text/plain;charset=utf-8' }),
                          '装车询价单.txt',
                        );
                        setStatus('询价单已生成，可自行发送给车店');
                      } catch {
                        setStatus('导出未完成，请重试');
                      }
                    }}
                  >
                    <Download size={16} />
                    导出询价单
                  </button>
                </details>
              </section>
              <section className="st-panel">
                <details className="st-settings st-cost-settings">
                  <summary>
                    费用与重量口径 <span>预算、工时、旧件转售</span>
                  </summary>
                  <div className="st-fields">
                    <NumberField
                      label="本次预算 / 元"
                      value={plan.budget}
                      set={(budget) => change({ ...plan, budget })}
                    />
                    <NumberField
                      label="工时与运费 / 元"
                      value={plan.labor}
                      set={(labor) => change({ ...plan, labor })}
                    />
                    <NumberField
                      label="清单外安装件与耗材 / 元"
                      value={plan.consumables}
                      set={(consumables) => change({ ...plan, consumables })}
                    />
                    {plan.mode === 'upgrade' && (
                      <NumberField
                        label="拆下旧件预计转售合计 / 元"
                        value={plan.resale}
                        set={(resale) => change({ ...plan, resale })}
                      />
                    )}
                  </div>
                  <p className="st-fine">
                    没有这项费用时填写 0。清单已经包含的安装件不再重复计入杂费，转售价格是你的预估。
                  </p>
                  {plan.mode === 'upgrade' && (
                    <>
                      <NumberField
                        label="现车实测重量 / g"
                        value={plan.baselineWeight}
                        placeholder="可选；例如 8200"
                        set={(baselineWeight) => change({ ...plan, baselineWeight })}
                      />
                      <label className="st-checkbox">
                        <input
                          type="checkbox"
                          checked={plan.weightAligned}
                          onChange={(e) => change({ ...plan, weightAligned: e.target.checked })}
                        />
                        已列出所有拆下的零件，且新旧重量的附件范围一致
                      </label>
                    </>
                  )}
                  <label>
                    方案备注
                    <textarea
                      value={plan.notes}
                      maxLength={3000}
                      placeholder="用途、偏好、车店报价说明等"
                      onChange={(e) => change({ ...plan, notes: e.target.value })}
                    />
                  </label>
                </details>
              </section>
              <section className="st-panel">
                <details className="st-settings">
                  <summary>
                    安装条件 <span>接口与规则检查</span>
                  </summary>
                  <p>
                    填入现车接口后，核对所选配件。每项判断保留其依据，未触发冲突不代表整车已经通过装配检查。
                  </p>
                  <div className="st-fields">
                    {(
                      [
                        ['axle', '轴端', ['12×100 / 12×142', '快拆', '其他']],
                        ['rotor', '现有碟片接口', ['Center Lock', '六钉', '圈刹']],
                        ['freehub', '塔基 / 飞轮制式', ['HG 公路 11/12 速', 'XDR', '其他']],
                      ] as const
                    ).map(([key, name, values]) => (
                      <label key={key}>
                        {name}
                        <select
                          value={plan.interfaces[key]}
                          onChange={(e) =>
                            change({
                              ...plan,
                              interfaces: { ...plan.interfaces, [key]: e.target.value },
                            })
                          }
                        >
                          <option value="">未填写</option>
                          {values.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label>
                      当前曲柄 / 中轴
                      <input
                        value={plan.interfaces.crank}
                        placeholder="按实车型号填写"
                        onChange={(e) =>
                          change({
                            ...plan,
                            interfaces: { ...plan.interfaces, crank: e.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="st-checks">
                    {advice.map((a, i) => (
                      <p key={i} className={a.level}>
                        <b>
                          {a.level === 'conflict'
                            ? '存在冲突'
                            : a.level === 'info'
                              ? '规格说明'
                              : '安装核对'}
                        </b>
                        {a.text}
                      </p>
                    ))}
                    {!advice.length && <p>选择配件后显示已覆盖的规则检查。</p>}
                  </div>
                  <div className="st-inline-actions">
                    <a href={`${base}?view=workshop&tool=interfaces`}>接口详解 ↗</a>
                    <a href={`${base}?view=workshop&tool=fit`}>轮胎与轮圈 ↗</a>
                    <a href={`${base}?view=learn&category=science`}>骑行科学 ↗</a>
                  </div>
                </details>
              </section>
            </>
          )}
          {tab === 'parts' && (
            <PartsPicker
              parts={parts}
              category={category}
              setCategory={setCategory}
              add={add}
              detail={setDetail}
              full={plan.items.length >= 60}
              back={() => setTab('build')}
              custom={() => {
                change({ ...plan, items: [...plan.items, customItem(category)] });
                setTab('build');
              }}
              addFrame={(f, variant, quote) => {
                const item = applyPurchaseQuote(
                  {
                    ...customItem('frame'),
                    name: f.name,
                    variant,
                    reference: f.price,
                    source: f.source,
                  },
                  quote,
                );
                change({ ...plan, items: [...plan.items, item] });
                setStatus(`已加入 ${f.name}`);
              }}
            />
          )}
          {tab === 'quotes' && (
            <QuoteWorkbench plan={plan} exportFile={exportFile} editPlan={() => setTab('build')} />
          )}
          {tab === 'fit' && (
            <>
              <button onClick={() => setTab('build')}>
                <ArrowLeft size={17} />
                返回装车台
              </button>
              <FitTransfer plan={plan} catalog={catalog} change={change} />
            </>
          )}
          {tab === 'plans' && (
            <section className="st-panel">
              <div className="st-section-title">
                <div>
                  <h2>我的方案</h2>
                  <p>保存当前配置，再换一套配件比较。方案保存在当前设备，可导出备份。</p>
                </div>
                <button disabled={!valid} onClick={save}>
                  <Plus size={16} />
                  保存当前方案
                </button>
              </div>
              <div className="st-inline-actions">
                <button onClick={() => file.current?.click()}>
                  <Download size={16} />
                  导入方案文件
                </button>
                {legacy && <button onClick={legacy}>打开旧版私人方案</button>}
                <a href={`${base}?view=garage`}>车型收藏 ↗</a>
              </div>
              <input
                hidden
                ref={file}
                type="file"
                accept=".velodex,.json,application/json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 256 * 1024) {
                    setStatus('文件超过 256 KB');
                    return;
                  }
                  try {
                    const raw = JSON.parse(await f.text()),
                      p = parsePlan(raw.plan || raw);
                    if (!p) throw Error();
                    setPending(p);
                  } catch {
                    setStatus('文件格式无效，当前方案未改变');
                  }
                }}
              />
              {!shelf.length && (
                <div className="st-empty">
                  <Bookmark size={30} />
                  <h3>把值得比较的配置留下来</h3>
                  <p>保存后可以并排查看费用、重量与配件差异。</p>
                </div>
              )}
              <div className="st-plan-grid">
                {shelf.map((s) => {
                  const t = estimate(s.plan);
                  return (
                    <article key={s.id}>
                      <small>
                        {new Date(s.date).toLocaleDateString('zh-CN')} ·{' '}
                        {s.plan.mode === 'build' ? '装车' : '升级'}
                      </small>
                      <h3>{s.plan.title}</h3>
                      <p>{s.plan.bikeName || '自定义车辆'}</p>
                      <strong>{money(t.net)}</strong>
                      <small>
                        {t.priceComplete ? '净支出估算' : '已知净支出'} · {s.plan.items.length} 项
                      </small>
                      <div className="st-inline-actions">
                        <button onClick={() => setCompare(s)}>与当前方案对比</button>
                        <button onClick={() => setPending(s.plan)}>载入</button>
                        <button
                          className="st-icon"
                          aria-label={`删除方案${s.plan.title}`}
                          onClick={() => {
                            if (writeShelf(shelf.filter((x) => x.id !== s.id))) setRemoved(s);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {removed && (
                <button
                  onClick={() => {
                    if (writeShelf([removed, ...shelf])) setRemoved(null);
                  }}
                >
                  <Undo2 size={16} />
                  恢复刚移除的方案
                </button>
              )}
            </section>
          )}
        </div>
        <aside className="st-summary">
          <span className="st-kicker">当前方案</span>
          <h2>{plan.title || '我的方案'}</h2>
          <p>
            {plan.bikeName || (plan.mode === 'upgrade' ? '尚未指定现车' : '自由装车')} {plan.size}
          </p>
          <div className="st-total">
            <small>{total.priceComplete ? '净支出估算' : '已知净支出'}</small>
            <strong>{money(total.net)}</strong>
            <span>
              新件 {money(total.subtotal)} · {total.priced}/
              {plan.items.filter((i) => i.action === 'buy').length} 项有报价
            </span>
          </div>
          <CostBreakdown plan={plan} />
          <button className="st-cost-edit" onClick={editCosts}>
            调整预算与杂费 <ArrowRight size={14} />
          </button>
          {(total.missingPrices.length > 0 || total.missingFees.length > 0) && (
            <div className="st-summary-note">
              未计入：
              {[
                ...total.missingPrices.map((i) => i.name || label(i.category)),
                ...total.missingFees,
              ].join('、')}
            </div>
          )}
          <div className="st-summary-weight">
            <small>{plan.mode === 'build' ? '所列车上零件重量' : '升级后整车估重'}</small>
            <strong>
              {total.weight !== null
                ? `${(total.weight / 1000).toFixed(3)} kg`
                : '可先选配，稍后补重量'}
            </strong>
            <p>
              {plan.mode === 'upgrade'
                ? '需现车重量、全部新旧件重量及相同称量范围。'
                : '仅计算清单内车上零件，未列附件不在合计内。'}
            </p>
          </div>
          {total.coverage.length > 0 && (
            <p className="st-fine">
              整车清单还未列出：{total.coverage.map((c) => label(c as Category)).join('、')}
              。包装内已包含的部件请记入版本说明。
            </p>
          )}
          <button
            onClick={() => {
              setTab('build');
              requestAnimationFrame(() => {
                const target = document.querySelector('.st-checks');
                const section = target?.closest('details');
                if (section) section.open = true;
                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }}
            className="st-check-link"
          >
            {advice.filter((a) => a.level === 'conflict').length
              ? `${advice.filter((a) => a.level === 'conflict').length} 项配置冲突`
              : '查看安装条件'}{' '}
            <ArrowRight size={16} />
          </button>
          <div className="st-summary-actions">
            <button className="st-primary" disabled={!valid} onClick={save}>
              <Bookmark size={17} />
              保存方案
            </button>
            <button disabled={!valid} onClick={share}>
              <Share2 size={17} />
              分享可编辑链接
            </button>
            <button disabled={busy || !valid} onClick={makePoster}>
              <Download size={17} />
              {busy ? '正在生成…' : '生成 PNG 海报'}
            </button>
            <button disabled={!valid} onClick={exportPlan}>
              导出方案文件
            </button>
          </div>
          <p className="st-fine">
            参考价不代表成交价。沿用件不重复计价，拆下件的转售金额在费用区填写。
          </p>
        </aside>
      </div>
      <div className="st-help-links">
        <a href={`${base}?view=bikes`}>车型资料</a>
        <a href={`${base}?view=discover`}>专题与科普</a>
        <a href={`${base}?view=workshop&tool=gears`}>齿比工具</a>
        <a href={`${base}?view=feedback&kind=correction`}>补充资料与纠错 ↗</a>
      </div>
      <dialog
        className="st-dialog st-cost-dialog"
        ref={costDialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) costDialog.current?.close();
        }}
      >
        <div>
          <button
            className="st-dialog-close st-icon"
            aria-label="关闭费用明细"
            onClick={() => costDialog.current?.close()}
          >
            <X size={20} />
          </button>
          <span className="st-kicker">{plan.title || '当前方案'}</span>
          <h2>这份方案要花多少钱</h2>
          <div className="st-total">
            <small>{total.priceComplete ? '净支出估算' : '已知净支出'}</small>
            <strong>{money(total.net)}</strong>
          </div>
          <CostBreakdown plan={plan} />
          {!!total.missingPrices.length && (
            <p className="st-summary-note">
              尚无报价：{total.missingPrices.map((i) => i.name || label(i.category)).join('、')}
            </p>
          )}
          {!!total.coverage.length && (
            <p className="st-summary-note">
              整车清单未列出：{total.coverage.map((c) => label(c as Category)).join('、')}
              。当前合计不是完整整车费用。
            </p>
          )}
          <button className="st-primary" onClick={editCosts}>
            调整预算与杂费 <ArrowRight size={16} />
          </button>
        </div>
      </dialog>
      <dialog
        className="st-dialog"
        ref={dialog}
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div>
          <button className="st-dialog-close st-icon" aria-label="关闭" onClick={close}>
            <X size={20} />
          </button>
          {detail && (
            <>
              <span className="st-kicker">{label(detail.category)}</span>
              <h2>{detail.name}</h2>
              {detail.image && (
                <>
                  <img className="st-detail-image" src={imageUrl(detail.image)} alt={detail.name} />
                  <PhotoButton
                    asset={productPhoto(detail)!}
                    alternatives={parts.products
                      .filter((p) => p.category === detail.category)
                      .flatMap((p) => (productPhoto(p) ? [productPhoto(p)!] : []))}
                  />
                </>
              )}
              {detail.familyId && (
                <label>
                  同系列规格
                  <select
                    value={detail.id}
                    onChange={(e) =>
                      setDetail(parts.products.find((p) => p.id === e.target.value) || detail)
                    }
                  >
                    {parts.products
                      .filter((p) => p.familyId === detail.familyId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.optionLabel || p.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <p>{detail.description}</p>
              <dl>
                {detail.specs.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p>{detail.compatibility}</p>
              <p>{detail.tradeoff}</p>
              {detail.price && (
                <p>
                  {referencePriceLabel(detail.price)} · {detail.price.scope} ·{' '}
                  {detail.price.checkedAt}
                </p>
              )}
              {detail.price && <p className="st-note">{detail.price.note}</p>}
              {detail.ordering && (
                <div className="st-note">
                  <strong>请让报价单写清楚</strong>
                  <ul>
                    {detail.ordering.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <PurchaseControls
                key={detail.id}
                profile={productProfile(detail)}
                category={detail.category}
                reference={detail.price}
                quantity={detail.category === 'tires' && detail.id !== 'aero111' ? 2 : 1}
                full={plan.items.length >= 60}
                add={(quote) => add(detail, quote)}
              />
              <div className="st-inline-actions">
                <a href={detail.source} target="_blank" rel="noreferrer">
                  查看原始资料 ↗
                </a>
              </div>
            </>
          )}
          {pending && (
            <>
              <span className="st-kicker">载入预览</span>
              <h2>{pending.title}</h2>
              <p>
                {pending.bikeName || '不限定车型'} ·{' '}
                {pending.mode === 'upgrade' ? '现车升级' : '从零装车'}
              </p>
              <p>
                {pending.items.length} 项零件 · 已知净支出 {money(estimate(pending).net)}
              </p>
              {pending.items.length > 0 && (
                <ul className="st-import-items">
                  {pending.items.map((item) => (
                    <li key={item.key}>
                      <strong>{item.name || label(item.category)}</strong>
                      <span>
                        {item.action === 'buy' ? '购入' : item.action === 'keep' ? '沿用' : '拆下'}
                        {' · '}
                        {item.quantity} 件{item.variant ? ` · ${item.variant}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {pending.notes && <p className="st-note">{pending.notes}</p>}
              <p>载入后替换正在编辑的草稿，方案架不受影响。可以先保存当前方案；载入后也可撤销。</p>
              <div className="st-inline-actions">
                <button onClick={save}>先保存当前方案</button>
                <button
                  className="st-primary"
                  onClick={() => {
                    change(structuredClone(pending));
                    setPending(null);
                    setTab('build');
                    const url = new URL(location.href);
                    if (url.hash.startsWith('#plan=')) url.hash = '';
                    url.searchParams.delete('useBike');
                    url.searchParams.delete('addProduct');
                    history.replaceState(history.state, '', url);
                  }}
                >
                  载入并继续编辑
                </button>
              </div>
            </>
          )}
          {compare && (
            <>
              <span className="st-kicker">方案对比</span>
              <h2>这次更换，差在哪里</h2>
              <div className="st-compare-names">
                <b>当前 · {plan.title}</b>
                <b>保存 · {compare.plan.title}</b>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>当前方案</th>
                    <th>保存方案</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>车辆 / 尺码</th>
                    <td>
                      {plan.bikeName} {plan.size}
                    </td>
                    <td>
                      {compare.plan.bikeName} {compare.plan.size}
                    </td>
                  </tr>
                  <tr>
                    <th>
                      净支出
                      {(!total.priceComplete || !estimate(compare.plan).priceComplete) &&
                        '（部分计价）'}
                    </th>
                    <td>{money(total.net)}</td>
                    <td>{money(estimate(compare.plan).net)}</td>
                  </tr>
                  <tr>
                    <th>重量 / kg</th>
                    <td>
                      {total.weight === null ? '未完整计算' : (total.weight / 1000).toFixed(3)}
                    </td>
                    <td>
                      {estimate(compare.plan).weight === null
                        ? '未完整计算'
                        : (estimate(compare.plan).weight! / 1000).toFixed(3)}
                    </td>
                  </tr>
                  {categories
                    .filter(([id]) =>
                      [...plan.items, ...compare.plan.items].some((i) => i.category === id),
                    )
                    .map(([id, name]) => (
                      <tr key={id}>
                        <th>{name}</th>
                        {[plan, compare.plan].map((p, i) => (
                          <td key={i}>
                            {p.items
                              .filter((x) => x.category === id)
                              .map((x) => (
                                <p key={x.key}>
                                  {x.name} × {x.quantity}
                                  <small>
                                    {x.variant} ·{' '}
                                    {{ buy: '购入', keep: '沿用', remove: '拆下' }[x.action]}
                                  </small>
                                </p>
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
              <p>
                当前方案相对保存方案的已知净支出：{money(total.net - estimate(compare.plan).net)}
                。两边计价完整后再比较最终预算。
              </p>
            </>
          )}
          {link && (
            <>
              <span className="st-kicker">分享方案</span>
              <h2>让车友接着改一版</h2>
              <p>
                链接包含清单、报价、备注与把位设定。接收者可查看并复制编辑，不会覆盖你的原方案。
              </p>
              <label>
                可编辑链接
                <textarea readOnly value={link} onFocus={(e) => e.target.select()} />
              </label>
              <div className="st-inline-actions">
                <button
                  className="st-primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setStatus('方案链接已复制');
                    } catch {
                      setStatus('请选中链接手动复制');
                    }
                  }}
                >
                  <Copy size={16} />
                  复制链接
                </button>
                {typeof navigator.share === 'function' && (
                  <button
                    onClick={() =>
                      navigator
                        .share({ title: plan.title, url: link })
                        .catch(() => setStatus('系统分享已取消或未完成'))
                    }
                  >
                    <Share2 size={16} />
                    系统分享
                  </button>
                )}
                <button
                  onClick={() =>
                    exportFile(
                      new Blob([planText(plan)], { type: 'text/plain;charset=utf-8' }),
                      '装车清单.txt',
                    ).catch(() => setStatus('导出未完成'))
                  }
                >
                  导出文字清单
                </button>
              </div>
              <p className="st-fine">长链接在部分聊天软件中可能被截断，也可分享方案文件。</p>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
function NumberField({
  label,
  value,
  set,
  placeholder = '没有此项填写 0',
}: {
  label: string;
  value: string;
  set: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        max="1000000"
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
