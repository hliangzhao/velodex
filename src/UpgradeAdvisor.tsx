import { useState } from 'react';
import { ArrowUpRight, Check, Download, Plus, Save, Share2, X } from 'lucide-react';
import type { Catalog, PartCategory, PartsCatalog, Product } from './types';
import { imageUrl } from './catalog';
import { base } from './SiteChrome';
import {
  candidateNote,
  cny,
  costSummary,
  initialAdvisor,
  numberOrNull,
  parseAdvisor,
  planAdvice,
  priceLabel,
  priorities,
  quotePrice,
  routes,
  upgradeCategories,
  wheelWeightChange,
} from './upgrade-planner';
import type { AdvisorState } from './upgrade-planner';
import './upgrade-advisor.css';
const storageKey = 'velodex.upgrade-advisor.v1';
function restore(products: Product[]) {
  try {
    const hash = location.hash;
    if (hash.startsWith('#upgrade='))
      return parseAdvisor(decodeURIComponent(hash.slice(9)), products) || initialAdvisor();
    const saved = localStorage.getItem(storageKey);
    return saved ? parseAdvisor(saved, products) || initialAdvisor() : initialAdvisor();
  } catch {
    return initialAdvisor();
  }
}
function NumberField({
  label,
  value,
  set,
  placeholder = '不知道可留空',
  max = 1000000,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder?: string;
  max?: number;
}) {
  const invalid = !!value && numberOrNull(value, max) === null;
  return (
    <label className="upgrade-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        max={max}
        step="any"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => set(e.target.value)}
      />
      {invalid && <small>请输入 0–{max.toLocaleString()} 之间的数字</small>}
    </label>
  );
}
function Price({ product }: { product: Product }) {
  return (
    <div className="upgrade-price">
      <strong>{priceLabel(product)}</strong>
      <small>{product.chinaPrice?.scope}</small>
    </div>
  );
}
export default function UpgradeAdvisor({
  parts,
  catalog,
}: {
  parts: PartsCatalog;
  catalog: Catalog;
}) {
  const [state, setState] = useState<AdvisorState>(() => restore(parts.products));
  const [category, setCategory] = useState<PartCategory>('wheels');
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [pricedOnly, setPricedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState('');
  const [message, setMessage] = useState(() => {
    if (!location.hash.startsWith('#upgrade=')) return '';
    try {
      return parseAdvisor(decodeURIComponent(location.hash.slice(9)), parts.products)
        ? '已打开分享方案；点击保存才会替换此浏览器的已存方案。'
        : '分享内容无效或不完整，已显示 AD7 示例，请重新取得链接。';
    } catch {
      return '分享内容无法读取，已显示 AD7 示例。';
    }
  });
  const [shareUrl, setShareUrl] = useState('');
  const [catalogBike, setCatalogBike] = useState('');
  const patch = <K extends keyof AdvisorState>(key: K, value: AdvisorState[K]) =>
    setState((s) => ({ ...s, [key]: value }));
  const money = costSummary(state, parts.products);
  const advice = planAdvice(state, parts.products);
  const weight = wheelWeightChange(state, parts.products);
  const budget = numberOrNull(state.budget);
  const conflicts = advice.filter((a) => a.level === 'conflict');
  const selected = state.picks.map((q) => ({ q, p: parts.products.find((p) => p.id === q.id)! }));
  const wheel = selected.find(({ p }) => p.category === 'wheels')?.p;
  const brands = parts.brands.filter((b) =>
    parts.products.some((p) => p.category === category && p.brandId === b.id),
  );
  const products = parts.products
    .filter(
      (p) =>
        p.category === category &&
        (brand === 'all' || p.brandId === brand) &&
        (!pricedOnly || p.chinaPrice?.amount != null) &&
        (!maxPrice ||
          p.chinaPrice?.amount == null ||
          p.chinaPrice.amount <= (numberOrNull(maxPrice) ?? Infinity)) &&
        `${p.name} ${p.brandId} ${parts.brands.find((b) => b.id === p.brandId)?.name} ${p.specs.flat().join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => (a.chinaPrice?.amount ?? Infinity) - (b.chinaPrice?.amount ?? Infinity));
  const chooseCategory = (cat: PartCategory) => {
    setCategory(cat);
    setBrand('all');
    setQuery('');
  };
  const add = (p: Product) => {
    if (state.picks.some((q) => q.id === p.id)) return;
    setState((s) => ({
      ...s,
      picks: [
        ...s.picks.filter(
          (q) =>
            !['wheels', 'powermeters', 'computers', 'shoes'].includes(p.category) ||
            parts.products.find((x) => x.id === q.id)?.category !== p.category,
        ),
        { id: p.id, price: '', quantity: p.category === 'tires' ? 2 : 1, version: '' },
      ],
      ...(p.category === 'wheels' ? { newWheelWeight: '', sameWeightScope: false } : {}),
    }));
    setMessage(`已加入 ${p.name}。轮组、功率计、码表和锁鞋各保留一款，可直接改选。`);
  };
  const updateQuote = (id: string, fields: Partial<AdvisorState['picks'][number]>) =>
    setState((s) => ({ ...s, picks: s.picks.map((q) => (q.id === id ? { ...q, ...fields } : q)) }));
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setMessage('升级方案已保存在此浏览器。');
    } catch {
      setMessage('浏览器未允许本地保存，可改用分享链接或导出清单。');
    }
  };
  const share = async () => {
    const url = new URL(location.href);
    url.search = '?view=workshop&tool=advisor';
    url.hash = `upgrade=${encodeURIComponent(JSON.stringify(state))}`;
    setShareUrl(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setMessage('方案链接已复制；包含你的报价与选项，不会上传骑行数据。');
    } catch {
      setMessage('请从下方复制方案链接。');
    }
  };
  const exportPlan = () => {
    const text = [
      `VÉLODEX 升级询价单 · ${new Date().toLocaleDateString('zh-CN')}`,
      state.bike,
      `净预算：${state.budget || '待定'} 元；${routes[state.route]}；${priorities[state.priority]}`,
      `现车接口：${state.freehub} / ${state.rotor} / ${state.axle}；曲柄 ${state.crank || '未知'}`,
      '',
      ...selected.flatMap(({ p, q }) => [
        `${p.name} ×${q.quantity}`,
        `版本：${q.version || p.chinaPrice?.scope || '待确认'}`,
        `单价：${quotePrice(q, p) === null ? '待询价' : cny(quotePrice(q, p)!)}（${q.price ? '读者报价' : priceLabel(p)}）`,
        `${p.chinaPrice?.note || ''}`,
        `参数来源：${p.source}`,
        `价格来源：${p.chinaPrice?.source || '读者报价'}`,
        `核对：${p.compatibility}`,
        '',
      ]),
      `工时 / 运费：${state.installation || '待询价'}；适配 / 耗材：${state.adapters || '待询价'}`,
      `旧轮转售：${money.applySale ? `${state.resaleLow}–${state.resaleHigh} 元，读者估计` : '不扣除'}`,
      `${money.complete ? '预计净支出' : '已知金额小计，非最终预算'}：${cny(money.min)}–${cny(money.max)}`,
      `尚缺：${money.missing.join('、') || '无未报价项目；仍需确认实际成交及安装'}`,
      '',
      ...advice.map((a) => a.text),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'velodex-升级询价单.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('已导出清单，包含价格来源、规格备注及待核对项目。');
  };
  return (
    <div className="upgrade-advisor">
      <section className="upgrade-intro">
        <div>
          <span className="eyebrow">UPGRADE YOUR RIDE</span>
          <h2>把升级预算花在合适的地方</h2>
          <p>
            从你已经拥有的车出发，选择用途和预算，再比较配件与实际改装费用。重量不知道也能继续。
          </p>
        </div>
        <a href={`${base}?view=parts`}>
          {parts.products.length} 份配件档案 <ArrowUpRight size={18} />
        </a>
      </section>
      <section className="upgrade-step">
        <div className="upgrade-step-title">
          <span>01</span>
          <div>
            <h3>现有车辆与骑行偏好</h3>
            <p>示例采用读者提供的 AD7 数据；可以修改，也可以换成自己的车。</p>
          </div>
        </div>
        <div className="upgrade-fields">
          <label className="upgrade-field">
            <span>车辆名称</span>
            <input
              value={state.bike}
              maxLength={200}
              onChange={(e) => patch('bike', e.target.value)}
            />
          </label>
          <label className="upgrade-field">
            <span>从整车图鉴选择</span>
            <select
              value={catalogBike}
              onChange={(e) => {
                setCatalogBike(e.target.value);
                const bike = catalog.bikes.find((b) => b.id === e.target.value);
                if (bike)
                  setState((s) => ({
                    ...s,
                    bike: `${bike.name} ${bike.edition}`,
                    bikePrice: '',
                    bikeWeight: '',
                    crank: '',
                    freehub: 'unknown',
                    rotor: 'unknown',
                    axle: 'unknown',
                    oldWheelWeight: '',
                    newWheelWeight: '',
                    sameWeightScope: false,
                    sale: false,
                  }));
              }}
            >
              <option value="">选择车型（价格、重量留待核对）</option>
              {catalog.bikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.edition}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="购车价格 / 元（参考背景）"
            value={state.bikePrice}
            set={(v) => patch('bikePrice', v)}
          />
          <NumberField
            label="现车重量 / g（可不填）"
            value={state.bikeWeight}
            set={(v) => patch('bikeWeight', v)}
            max={100000}
          />
          <NumberField
            label="本次净预算 / 元"
            value={state.budget}
            set={(v) => patch('budget', v)}
            placeholder="例如 6000"
          />
        </div>
        <p className="upgrade-note">
          AD7 示例：¥13,980、M 码约 8.44
          kg，均为读者提供；称重附件范围待确认。官网整车重量与实际装车称重可能口径不同。C45 SL
          原轮组重量留空，不以估计值计算减重。
        </p>
        <div className="upgrade-preferences">
          <fieldset>
            <legend>主要骑行路况</legend>
            {Object.entries(routes).map(([id, label]) => (
              <label key={id}>
                <input
                  type="radio"
                  name="upgrade-route"
                  value={id}
                  checked={state.route === id}
                  onChange={() => patch('route', id as AdvisorState['route'])}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>这次最想改善什么</legend>
            {Object.entries(priorities).map(([id, label]) => (
              <label key={id}>
                <input
                  type="radio"
                  name="upgrade-priority"
                  value={id}
                  checked={state.priority === id}
                  onChange={() => patch('priority', id as AdvisorState['priority'])}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="upgrade-direction">
          <strong>按你的选择，先看这些</strong>
          <p>
            {state.priority === 'training'
              ? '如果主要想掌握配速、训练负荷和进步趋势，可先比较功率计与记录设备，轮组可以继续保留。'
              : state.priority === 'weight'
                ? '先取得原轮组同口径重量，再比较整对重量、净改装费用及备件成本。几百克差异不足以说明平路巡航速度。'
                : state.priority === 'speed'
                  ? '先确认骑姿、轮胎与胎压，再看有同条件气动数据的轮组。当前资料不足以给候选轮组排出“省瓦数”名次。'
                  : '将安装、耗材、售后和备件一起计入成本；现有配件运转正常时，保留也是可选方案。'}
            {state.route === 'wind'
              ? ' 常遇侧风时，前轮操控优先于单纯追求高框。'
              : state.route === 'climb'
                ? ' 爬坡较多时，也要确认最低齿比是否合适。'
                : ''}
          </p>
          <button
            onClick={() => chooseCategory(state.priority === 'training' ? 'powermeters' : 'wheels')}
          >
            查看相关候选 ↓
          </button>
        </div>
        <details className="upgrade-details">
          <summary>已有设备与接口（不知道可暂时不选）</summary>
          <div className="upgrade-fields">
            <label className="upgrade-field">
              <span>曲柄 / 中轴 / 长度</span>
              <input
                value={state.crank}
                maxLength={200}
                onChange={(e) => patch('crank', e.target.value)}
                placeholder="例如 FC-R7100，170 mm"
              />
            </label>
            {(
              [
                ['freehub', '现有飞轮塔基', ['unknown', 'HG 公路 11/12 速', 'XDR', '其他']],
                ['rotor', '现有碟片接口', ['unknown', 'Center Lock', '六钉', '圈刹']],
                ['axle', '前后轴端', ['unknown', '12×100 / 12×142', '快拆', '其他']],
                ['ownedCleat', '现有锁踏制式', ['unknown', 'SPD-SL', 'KEO', 'SPD', 'Speedplay']],
                ['ownedShoe', '现有锁鞋孔位', ['unknown', '2', '3', '4']],
              ] as const
            ).map(([key, label, opts]) => (
              <label className="upgrade-field" key={key}>
                <span>{label}</span>
                <select value={state[key]} onChange={(e) => patch(key, e.target.value)}>
                  {opts.map((v) => (
                    <option key={v} value={v}>
                      {v === 'unknown' ? '不知道 / 尚未选择' : key === 'ownedShoe' ? `${v} 孔` : v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="upgrade-checks">
            {(
              [
                ['ownedPower', '已有功率计（输出踏频）'],
                ['ownedComputer', '已有可记录功率的码表 / App'],
                ['ownedHeart', '已有心率数据源'],
                ['ownedCadence', '已有踏频传感器'],
                ['ownedSpeed', '已有速度传感器'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={state[key]}
                  onChange={(e) => patch(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="upgrade-note">
            AD7
            不同年份与销售配置可能不同。请以实车标识为准；不知道接口时可以先做候选清单，最终安装结论留待核对。
          </p>
        </details>
      </section>
      <div className="upgrade-workspace">
        <section className="upgrade-step upgrade-candidates" aria-label="升级配件候选">
          <div className="upgrade-step-title">
            <span>02</span>
            <div>
              <h3>选择配件，比较具体版本</h3>
              <p>按国内官网价格由低到高排列，待询价项目保留在末尾。不是性能排名。</p>
            </div>
          </div>
          <div className="upgrade-category" role="group" aria-label="升级配件类别">
            {upgradeCategories.map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => chooseCategory(c.id)}
              >
                {c.name}
                <small>{parts.products.filter((p) => p.category === c.id).length}</small>
              </button>
            ))}
          </div>
          <div className="upgrade-filter">
            <label className="upgrade-field">
              <span>搜索型号或规格</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="如 P715、SPD-SL、23 mm"
              />
            </label>
            <label className="upgrade-field">
              <span>厂商</span>
              <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="all">全部厂商</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="单项价格上限 / 元"
              value={maxPrice}
              set={setMaxPrice}
              placeholder="不限；待询价仍显示"
            />
          </div>
          <label className="upgrade-inline-check">
            <input
              type="checkbox"
              checked={pricedOnly}
              onChange={(e) => setPricedOnly(e.target.checked)}
            />
            只看已有国内官方参考价的产品
          </label>
          <p className="upgrade-note">
            找到 {products.length}{' '}
            项。轮组价格是一对，传感器通常是单只，轮胎通常是单条；具体包装范围以每条记录为准。
          </p>
          {category === 'wheels' && (
            <button
              className="upgrade-keep"
              onClick={() => {
                setState((s) => ({
                  ...s,
                  picks: s.picks.filter(
                    (q) => parts.products.find((p) => p.id === q.id)?.category !== 'wheels',
                  ),
                  sale: false,
                  newWheelWeight: '',
                  sameWeightScope: false,
                }));
                setMessage('保留现有轮组；旧轮转售不再抵扣预算。');
              }}
            >
              保留现有轮组，先比较其他升级
            </button>
          )}
          <div className="upgrade-cards">
            {products.map((p) => (
              <article
                key={p.id}
                className={state.picks.some((q) => q.id === p.id) ? 'is-picked' : ''}
              >
                <div className="upgrade-card-head">
                  {p.image ? (
                    <img src={imageUrl(p.image)} alt={p.name} loading="lazy" />
                  ) : (
                    <div className="upgrade-no-image" aria-label="暂无已核实产品图">
                      规格
                      <br />
                      档案
                    </div>
                  )}
                  <div>
                    <small>{parts.brands.find((b) => b.id === p.brandId)?.name}</small>
                    <h4>{p.name}</h4>
                    <Price product={p} />
                  </div>
                </div>
                <dl>
                  {p.specs.slice(0, 3).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p>{candidateNote(p, state)}</p>
                <details>
                  <summary>规格、价格来源与核对项</summary>
                  <dl>
                    {p.specs.slice(3).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>{p.compatibility}</p>
                  <p>
                    {p.chinaPrice?.note} 核对：{p.chinaPrice?.checkedAt}
                  </p>
                  <a href={p.source} target="_blank" rel="noreferrer">
                    查看资料来源 ↗
                  </a>
                  {p.chinaPrice?.amount != null && (
                    <a
                      className="upgrade-price-source"
                      href={p.chinaPrice.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      价格出处 ↗
                    </a>
                  )}
                </details>
                <div className="upgrade-card-actions">
                  <a href={`${base}?view=parts&product=${p.id}`}>完整档案 ↗</a>
                  <button onClick={() => add(p)} disabled={state.picks.some((q) => q.id === p.id)}>
                    {state.picks.some((q) => q.id === p.id) ? (
                      <Check size={15} />
                    ) : (
                      <Plus size={15} />
                    )}{' '}
                    {state.picks.some((q) => q.id === p.id) ? '已加入' : '加入方案'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!products.length && <p>没有匹配项，可放宽价格上限或清除型号筛选。</p>}
        </section>
        <aside id="upgrade-plan" className="upgrade-plan" aria-label="我的升级方案">
          <div className="upgrade-step-title">
            <span>03</span>
            <div>
              <h3>我的升级方案</h3>
              <p>报价留空时使用已核实的国内参考价；没有参考价的项目继续保留为待询价。</p>
            </div>
          </div>
          <div role="status" className="upgrade-message">
            {message || '方案可保存在浏览器，也可导出给车店询价。'}
          </div>
          {!selected.length && (
            <div className="upgrade-plan-empty">
              先从左侧加入候选配件
              <br />
              <small>不用填写原件重量，也能算预算</small>
            </div>
          )}
          {selected.map(({ q, p }) => (
            <div className="upgrade-line" key={p.id}>
              <div>
                <h4>{p.name}</h4>
                <button
                  aria-label={`移除 ${p.name}`}
                  onClick={() =>
                    setState((s) => ({ ...s, picks: s.picks.filter((x) => x.id !== p.id) }))
                  }
                >
                  <X size={16} />
                </button>
              </div>
              <Price product={p} />
              <div className="upgrade-line-fields">
                <NumberField
                  label="你的含税报价 / 元"
                  value={q.price}
                  set={(v) => updateQuote(p.id, { price: v })}
                  placeholder={
                    p.chinaPrice?.amount != null ? String(p.chinaPrice.amount) : '待询价'
                  }
                />
                <label className="upgrade-field">
                  <span>数量 / 销售单位</span>
                  <select
                    value={q.quantity}
                    onChange={(e) => updateQuote(p.id, { quantity: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="upgrade-field">
                <span>规格备注 / 商家与日期</span>
                <input
                  value={q.version}
                  maxLength={200}
                  placeholder="轮高、塔基、曲柄长度、鞋码等"
                  onChange={(e) => updateQuote(p.id, { version: e.target.value })}
                />
              </label>
              {q.quantity > 1 && !['sensors', 'cleats', 'tires'].includes(p.category) && (
                <p className="upgrade-note">请确认数量：该产品的销售单位可能已是一对或一套。</p>
              )}
            </div>
          ))}
          <div className="upgrade-costs">
            <NumberField
              label="工时、运费合计 / 元"
              value={state.installation}
              set={(v) => patch('installation', v)}
              placeholder="未询价；免费请填 0"
            />
            <NumberField
              label="适配件、耗材合计 / 元"
              value={state.adapters}
              set={(v) => patch('adapters', v)}
              placeholder="中轴、碟片、气嘴、胎垫等"
            />
            <label className="upgrade-inline-check">
              <input
                type="checkbox"
                disabled={!wheel}
                checked={!!wheel && state.sale}
                onChange={(e) => patch('sale', e.target.checked)}
              />
              售出原轮组，抵扣本次费用
            </label>
            {!!wheel && state.sale && (
              <>
                <div className="upgrade-line-fields">
                  <NumberField
                    label="预计最低转售价 / 元"
                    value={state.resaleLow}
                    set={(v) => patch('resaleLow', v)}
                  />
                  <NumberField
                    label="预计最高转售价 / 元"
                    value={state.resaleHigh}
                    set={(v) => patch('resaleHigh', v)}
                  />
                </div>
                <p className="upgrade-note">
                  示例 ¥1,000–2,000 来自读者估计，不是已验证行情；在成交前仅作情景计算。
                </p>
              </>
            )}
          </div>
          <div className="upgrade-total" aria-live="polite">
            <span>{money.complete ? '预计净支出' : '已知金额小计'}</span>
            <strong>
              {money.min === money.max ? cny(money.min) : `${cny(money.min)}–${cny(money.max)}`}
            </strong>
            <small>
              {money.complete
                ? '参考价与报价的预算情景，实际成交可能变化'
                : selected.length
                  ? '费用尚未齐全，不能据此判断是否够预算'
                  : '尚未加入配件'}
            </small>
            {money.complete && budget !== null && (
              <p>
                {money.max <= budget
                  ? `预算内预计剩余 ${cny(budget - money.max)}–${cny(budget - money.min)}`
                  : money.min > budget
                    ? `预计超出预算 ${cny(money.min - budget)}–${cny(money.max - budget)}`
                    : '可能超出预算，取决于旧轮组实际转售价'}
              </p>
            )}
          </div>
          {!!money.missing.length && (
            <p className="upgrade-note">尚待填写：{money.missing.join('、')}。</p>
          )}
          <div className="upgrade-plan-actions">
            <button onClick={save}>
              <Save size={15} />
              保存
            </button>
            <button onClick={share}>
              <Share2 size={15} />
              分享方案
            </button>
            <button onClick={exportPlan} disabled={!selected.length}>
              <Download size={15} />
              导出询价单
            </button>
          </div>
          {shareUrl && (
            <label className="upgrade-field">
              <span>可复制的方案链接</span>
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            </label>
          )}
          <details className="upgrade-details">
            <summary>仅替换轮组的重量变化（选填）</summary>
            <p className="upgrade-note">
              {wheel?.selection?.weightG
                ? `所选轮组厂商标称 ${wheel.selection.weightG} g；${wheel.selection.weightScope}。`
                : '所选轮组没有可直接用于计算的重量。'}{' '}
              为避免称重范围不一致，请确认后填写。其他选中配件的增减重量不包含在此结果中。
            </p>
            <NumberField
              label="原轮组同口径重量 / g"
              value={state.oldWheelWeight}
              set={(v) => patch('oldWheelWeight', v)}
              max={10000}
            />
            <NumberField
              label="新轮组同口径重量 / g"
              value={state.newWheelWeight}
              set={(v) => patch('newWheelWeight', v)}
              max={10000}
            />
            <label className="upgrade-inline-check">
              <input
                type="checkbox"
                checked={state.sameWeightScope}
                onChange={(e) => patch('sameWeightScope', e.target.checked)}
              />
              已确认两者对胎垫、气嘴、碟片、飞轮、轮胎的计入方式一致
            </label>
            <p>
              {weight
                ? `只换轮组预计${weight.saved >= 0 ? '减轻' : '增加'} ${Math.abs(weight.saved).toFixed(0)} g，整车约 ${(weight.bike / 1000).toFixed(2)} kg。`
                : '同口径数据未齐，不估算减重。'}
            </p>
          </details>
        </aside>
      </div>
      <section className="upgrade-step upgrade-review">
        <div className="upgrade-step-title">
          <span>04</span>
          <div>
            <h3>检查搭配与数据来源</h3>
            <p>
              {conflicts.length
                ? `发现 ${conflicts.length} 项搭配冲突，需要调整。`
                : '这是选型核对表，不能代替实车检查。'}{' '}
              价格完整与兼容通过是两件事。
            </p>
          </div>
        </div>
        <div className="upgrade-checks">
          {(
            [
              ['needHeart', '希望记录心率'],
              ['needCadence', '希望记录踏频'],
              ['needSpeed', '希望有独立轮速数据'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={state[key]}
                onChange={(e) => patch(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <ul className="upgrade-advice">
          {advice.map((a, i) => (
            <li key={i} data-level={a.level}>
              <span>
                {a.level === 'conflict' ? '搭配冲突' : a.level === 'check' ? '待核对' : '可考虑'}
              </span>
              {a.text}
            </li>
          ))}
        </ul>
      </section>
      <div className="upgrade-mobile-jump">
        <span>
          {state.picks.length} 项 · 配件小计 {cny(money.subtotal)}
        </span>
        <a href="#upgrade-plan">查看方案与预算</a>
      </div>
      <UpgradeReading />
    </div>
  );
}
function UpgradeReading() {
  return (
    <section className="upgrade-reading">
      <span className="eyebrow">BEFORE YOU BUY</span>
      <h3>把规格读懂，再做取舍</h3>
      <details open>
        <summary>换轮组：重量、花鼓、稳定性和“巡航惯性”怎么看</summary>
        <p>
          相同速度下，质量集中在轮圈的轮组储存的转动动能更多，但加速时也需要投入更多能量。匀速巡航时，惯性不会持续提供推进力；需要克服的主要是空气阻力、滚动阻力等损耗。因此“重轮更保速”不能直接推导为“重轮巡航更省力”。
        </p>
        <p>
          先核对轮高、内外宽、胎圈结构、允许胎宽与系统限重，再看辐条和花鼓。棘轮齿数更多主要改变啮合角，陶瓷轴承标签也不能单独证明更低阻力。维护便利性要看密封、轴承尺寸、塔基与棘轮备件能否买到；碳辐条还要问单根更换及返厂流程。
        </p>
        <p>
          稳定性不能只按轮高排名。前轮轮廓、轮胎搭配、偏航角、骑手体重与操控都会影响侧风感受；没有同条件测量时，应把这一项保留为待试骑，而不是编造评分。
        </p>
        <a href={`${base}?view=learn&category=science`}>查看空气动力学、轮胎与功率专题 ↗</a>
      </details>
      <details>
        <summary>功率计：单边、盘爪和双边脚踏分别测到了什么</summary>
        <p>
          单边功率计测量一侧，再估算整车手的总输出。假设真实总功率 200 W、左腿占
          48%，左侧乘二就会得到 192 W；这里的 8 W
          差异并不等同于传感器自身精度差。用同一台设备持续训练仍有价值，但不要把单边读数当成独立双边测量。
        </p>
        <p>
          盘爪测得通过盘爪的总扭矩。它可能输出算法计算的左右平衡，不能直接理解为左右脚各有一个独立传感器。双边脚踏可以分别测量两侧，但还需要检查锁片标准、曲柄长度设置、校准流程及码表对骑行动态字段的支持。
        </p>
        <p>
          对 AD7 示例的
          FC-R7100，独立盘爪不是拆下即换的部件。应比较“保留牙盘、替换左曲柄”“更换曲柄与盘爪”“改用功率脚踏”三条路线，并把中轴、盘片、工时和锁片的费用计入。厂商的
          ±1% 是各自声明，不是本站统一条件下的实测排名。
        </p>
        <div className="upgrade-source-links">
          <a
            href="https://www.garmin.com.cn/products/sports-recreation/rally-rs100/"
            target="_blank"
            rel="noreferrer"
          >
            佳明单边功率说明 ↗
          </a>
          <a
            href="https://www.magene.cn/knowledge_help_detail.html?id=49"
            target="_blank"
            rel="noreferrer"
          >
            迈金双边脚踏规格 ↗
          </a>
        </div>
      </details>
      <details>
        <summary>码表与传感器：哪些需要另买，哪些可能重复</summary>
        <div className="upgrade-table-wrap">
          <table>
            <thead>
              <tr>
                <th>想看到的数据</th>
                <th>通常来自哪里</th>
                <th>是否要额外购买</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>户外速度、距离、轨迹</td>
                <td>码表 GNSS</td>
                <td>一般可直接记录；独立轮速用于补充遮挡环境，需正确设置轮周长</td>
              </tr>
              <tr>
                <td>踏频</td>
                <td>功率计或踏频传感器</td>
                <td>已有兼容功率计且输出踏频时通常不必重复购买</td>
              </tr>
              <tr>
                <td>心率</td>
                <td>胸带、臂带或可广播心率的手表</td>
                <td>码表本身通常不具备身体接触传感器</td>
              </tr>
              <tr>
                <td>实测功率</td>
                <td>功率计或智能骑行台</td>
                <td>有功率显示页面并不等于能独立测量</td>
              </tr>
              <tr>
                <td>导航</td>
                <td>码表地图、预载轨迹、手机协作</td>
                <td>区分轨迹线与可离线重规划的地图，核对国内固件功能</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          价格较高的码表主要可能改善屏幕、地图、操作、续航、定位和训练功能。连接同一台功率计时，功率读数的测量来源仍是功率计；平均方式、零值处理与记录间隔不同，也会造成显示差异。蓝牙与
          ANT+ 是连接方式，不能单凭协议名称判断精度。
        </p>
        <a href="https://www.igpsport.cn/product/bsc100max" target="_blank" rel="noreferrer">
          例：BSC100Max 外设协议与功能表 ↗
        </a>
      </details>
      <details>
        <summary>锁鞋、锁片、锁踏：先确定制式，再选浮动角度</summary>
        <p>
          SPD 通常使用二孔鞋底；SPD-SL 与 LOOK KÉO 通常使用三孔鞋底，但两者锁片不能互换。Speedplay
          原生四孔系统可按厂商说明使用对应三孔适配底板，不能因为“孔对得上”就自行混装。
        </p>
        <p>
          SPD-SL 黄色 SM-SH11 为 6° 浮动、蓝色 SM-SH12 为 2°、红色 SM-SH10 为 0°。LOOK KÉO 常见黑色
          0°、灰色 4.5°、红色
          9°。浮动范围与脱锁所需张力是不同参数；没有适合所有人的统一角度。购鞋优先确认脚长、脚宽、楦型和锁片可调范围，鞋重不计入整车重量。
        </p>
        <div className="upgrade-source-links">
          <a
            href="https://si.shimano.com/zh-CN/pdfs/dm/RAPD001/DM-RAPD001-03-CHI.pdf"
            target="_blank"
            rel="noreferrer"
          >
            禧玛诺中文锁踏手册 ↗
          </a>
          <a
            href="https://www.lookcycle.com/at-en/products/pedals/road/cleats/keo-grip"
            target="_blank"
            rel="noreferrer"
          >
            LOOK KÉO 锁片说明 ↗
          </a>
        </div>
      </details>
    </section>
  );
}
