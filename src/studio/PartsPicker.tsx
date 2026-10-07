import { useState } from 'react';
import { ArrowRight, Bike, Layers3, Plus, Search } from 'lucide-react';
import type { PartsCatalog, Product } from '../types';
import { imageUrl } from '../catalog';
import PhotoButton from '../PhotoButton';
import { referencePriceLabel } from '../upgrade-planner';
import { categories, label, type Category, type PurchaseQuote } from './model';
import PurchaseControls from './PurchaseControls';
import {
  findProducts,
  frames,
  matchesPrice,
  productFamilies,
  type FrameOption,
  type PriceFilter,
} from './library';

export default function PartsPicker({
  parts,
  category,
  setCategory,
  add,
  detail,
  addFrame,
  custom,
  back,
  full,
}: {
  parts: PartsCatalog;
  category: Category;
  setCategory: (c: Category) => void;
  add: (p: Product, quote: PurchaseQuote) => void;
  detail: (p: Product) => void;
  addFrame: (f: FrameOption, variant: string, quote: PurchaseQuote) => void;
  custom: () => void;
  back: () => void;
  full: boolean;
}) {
  const [query, setQuery] = useState(''),
    [brand, setBrand] = useState('all'),
    [price, setPrice] = useState<PriceFilter>('all');
  const products = findProducts(parts, category, query, brand, price);
  const availableFrames = frames.filter(
    (f) =>
      (brand === 'all' || f.brand === brand) &&
      matchesPrice(f.price, price) &&
      `${f.name} ${f.kind} ${f.specs.flat().join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  availableFrames.sort(
    (a, b) => Number(matchesPrice(b.price, 'cn')) - Number(matchesPrice(a.price, 'cn')),
  );
  const brands =
    category === 'frame'
      ? [...new Set(frames.map((f) => f.brand))].map((b) => ({ id: b, name: b }))
      : parts.brands.filter((b) =>
          parts.products.some((p) => p.category === category && p.brandId === b.id),
        );
  return (
    <section className="st-panel st-picker">
      <div className="st-section-title">
        <div>
          <h2>选配件</h2>
          <p>先选版本，再比较到手价</p>
        </div>
        <button onClick={back}>
          清单 <ArrowRight size={16} />
        </button>
      </div>
      <div className="st-categories" aria-label="零件类别">
        {categories.map(([id, name]) => (
          <button
            key={id}
            aria-pressed={category === id}
            onClick={() => {
              setCategory(id);
              setBrand('all');
              setQuery('');
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="st-search">
        <Search size={18} />
        <input
          type="search"
          aria-label="搜索配件"
          placeholder="品牌、型号、规格"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="st-picker-filters">
        <label>
          <span>厂商</span>
          <select aria-label="筛选厂商" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="all">全部厂商</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>参考价格</span>
          <select
            aria-label="参考价格地区"
            value={price}
            onChange={(e) => setPrice(e.target.value as PriceFilter)}
          >
            <option value="all">全部 · 大陆优先</option>
            <option value="cn">大陆人民币报价</option>
            <option value="foreign">海外价格</option>
            <option value="priced">有参考价</option>
          </select>
        </label>
      </div>
      <p className="st-results">
        {category === 'frame' ? availableFrames.length : products.length} 个可选版本
        <span>海外价格保留原币种</span>
      </p>
      <div className="st-product-grid">
        {category === 'frame'
          ? availableFrames.map((f) => (
              <FrameCard
                key={f.id}
                frame={f}
                add={(variant, quote) => addFrame(f, variant, quote)}
                full={full}
              />
            ))
          : productFamilies(products).map(([id, options]) => (
              <ProductCard
                key={id}
                options={options}
                parts={parts}
                add={add}
                detail={detail}
                full={full}
              />
            ))}
      </div>
      {!(category === 'frame' ? availableFrames.length : products.length) && (
        <div className="st-empty">
          <p>没有匹配的版本，试试调整筛选或添加自己的报价。</p>
          <button
            onClick={() => {
              setQuery('');
              setBrand('all');
              setPrice('all');
            }}
          >
            清除筛选
          </button>
        </div>
      )}
      <button disabled={full} onClick={custom}>
        <Plus size={16} />
        自行添加{label(category)}
      </button>
      <p className="st-fine st-picker-footnote">
        参考价用于估算，已收录价格可被你的实际报价覆盖。是否有现货、包含哪些附件，以所选规格的订单为准。
      </p>
    </section>
  );
}
function ProductCard({
  options,
  parts,
  add,
  detail,
  full,
}: {
  options: Product[];
  parts: PartsCatalog;
  add: (p: Product, quote: PurchaseQuote) => void;
  detail: (p: Product) => void;
  full: boolean;
}) {
  const [selected, setSelected] = useState(options[0].id);
  const p = options.find((p) => p.id === selected) || options[0];
  return (
    <article className="st-product">
      <button className="st-product-image" aria-label={`查看${p.name}`} onClick={() => detail(p)}>
        {p.image ? (
          <img src={imageUrl(p.image)} alt={p.name} loading="lazy" />
        ) : (
          <Layers3 size={42} />
        )}
      </button>
      <div className="st-product-content">
        <span className="st-product-brand">
          {parts.brands.find((b) => b.id === p.brandId)?.name}{' '}
          <em>{p.price?.market || '规格资料'}</em>
        </span>
        <h3>
          <button onClick={() => detail(p)}>{p.familyName || p.name}</button>
        </h3>
        {options.length > 1 && (
          <label className="st-version">
            <span>选择版本</span>
            <select
              aria-label={`${p.familyName}版本`}
              value={p.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.optionLabel || o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="st-product-facts">
          {p.specs
            .slice(0, 2)
            .map(([k, v]) => `${k} ${v}`)
            .join(' · ')}
        </p>
        <p className="st-product-price">
          {p.price ? referencePriceLabel(p.price) : '填写自己的到手价'}
        </p>
        <small>{p.price?.scope || p.era}</small>
        <div className="st-product-actions">
          <button onClick={() => detail(p)}>规格与订购</button>
        </div>
        <PurchaseControls
          key={p.id}
          reference={p.price}
          quantity={p.category === 'tires' && p.id !== 'aero111' ? 2 : 1}
          full={full}
          add={(quote) => add(p, quote)}
        />
      </div>
    </article>
  );
}
function FrameCard({
  frame: f,
  add,
  full,
}: {
  frame: FrameOption;
  add: (variant: string, quote: PurchaseQuote) => void;
  full: boolean;
}) {
  const [size, setSize] = useState(''),
    [paint, setPaint] = useState('');
  return (
    <article className="st-product st-frame-card">
      {f.image ? (
        <div className="st-frame-image">
          <img src={imageUrl(f.image)} alt={f.name} loading="lazy" />
        </div>
      ) : (
        <div className="st-frame-label">
          <Bike size={25} />
          {f.kind}
        </div>
      )}
      <div className="st-product-content">
        <span className="st-product-brand">
          {f.brand}
          <em>{f.market}</em>
        </span>
        <h3>{f.name}</h3>
        {f.image && (
          <PhotoButton
            asset={{
              id: f.id,
              name: f.name,
              image: f.image,
              source: f.imageSource || f.source,
              note: f.imageCaption,
            }}
            alternatives={frames
              .filter((g) => g.image)
              .map((g) => ({
                id: g.id,
                name: g.name,
                image: g.image!,
                source: g.imageSource || g.source,
                note: g.imageCaption,
              }))}
          />
        )}
        <p className="st-product-price">
          {f.price ? referencePriceLabel(f.price) : '填写自己的到手价'}
        </p>
        <small>
          {f.price
            ? `${f.price.scope} · 核对 ${f.price.checkedAt}`
            : '按中国官网规格选配，采用你的车店报价'}
        </small>
        <details className="st-frame-specs">
          <summary>尺码、涂装与接口</summary>
          {f.imageCaption && <p className="st-fine">{f.imageCaption}</p>}
          <dl>
            {f.specs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {!!f.sizes.length && (
            <label>
              尺码
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">加入后填写也可以</option>
                {f.sizes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          {!!f.paints.length && (
            <label>
              涂装
              <select value={paint} onChange={(e) => setPaint(e.target.value)}>
                <option value="">加入后填写也可以</option>
                {f.paints.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <p className="st-fine">{f.ordering.join('；')}。选项来自规格目录，不代表库存。</p>
          {f.price && <p className="st-fine">{f.price.note}</p>}
          <a href={f.source} target="_blank" rel="noreferrer">
            官方规格 ↗
          </a>
          {f.price && (
            <a href={f.price.source} target="_blank" rel="noreferrer">
              价格依据 ↗
            </a>
          )}
        </details>
        <PurchaseControls
          reference={f.price}
          full={full}
          add={(quote) => add([f.market, size, paint].filter(Boolean).join(' · '), quote)}
        />
      </div>
    </article>
  );
}
