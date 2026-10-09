import type { Bike, Catalog, PartsCatalog, Product, ReferencePrice } from '../types';
import { initialAdvisor, planAdvice } from '../upgrade-planner';
import {
  initialSales,
  productProfile,
  parseSales,
  salesText,
  type SalesSelection,
  type Condition,
} from './sales';

export const categories = [
  ['frame', '车架组'],
  ['wheels', '轮组'],
  ['groupsets', '变速系统'],
  ['tires', '轮胎'],
  ['handlebars', '车把'],
  ['seatposts', '座管'],
  ['saddles', '坐垫'],
  ['powermeters', '功率计'],
  ['computers', '码表'],
  ['pedals', '锁踏'],
  ['cleats', '锁片'],
  ['shoes', '锁鞋'],
  ['sensors', '传感器'],
  ['other', '安装件与耗材'],
] as const;
export type Category = (typeof categories)[number][0];
export type Point = { x: number; y: number };
export type Calibration = { rear: Point; front: Point; edge: Point; radiusMm: number };
export type FitSetup = {
  bikeId: string;
  size: string;
  spacers: number;
  cover: number;
  stemStack: number;
  stem: number;
  angle: number;
  barReach: number;
  saddleHeight: number;
  setback: number;
};
export type PlanItem = {
  key: string;
  productId: string;
  category: Category;
  name: string;
  variant: string;
  action: 'buy' | 'keep' | 'remove';
  quantity: number;
  price: string;
  weight: string;
  onBike: boolean;
  weightScope: string;
  source: string;
  reference?: ReferencePrice;
  sales?: SalesSelection;
};
export type Plan = {
  schema: 'velodex.studio';
  version: 1;
  title: string;
  mode: 'upgrade' | 'build';
  bikeId: string;
  bikeName: string;
  size: string;
  paintId: string;
  baselineWeight: string;
  budget: string;
  labor: string;
  consumables: string;
  resale: string;
  weightAligned: boolean;
  items: PlanItem[];
  notes: string;
  calibration: Calibration | null;
  visual: {
    depth: number;
    rearDepth: number;
    tire: number;
    sidewall: 'black' | 'tan';
    diameter: number;
  };
  interfaces: { axle: string; rotor: string; freehub: string; crank: string };
  fit: { a: FitSetup; b: FitSetup };
};
export type SavedPlan = { id: string; date: string; plan: Plan };
export const draftKey = 'velodex.studio.draft.v1';
export const shelfKey = 'velodex.studio.shelf.v1';
export const label = (category: Category) =>
  categories.find(([c]) => c === category)?.[1] || category;
export const money = (n: number) => '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
export type PurchaseQuote = { price: string; condition: Condition; sales?: SalesSelection };
export function validPurchaseQuote(quote: PurchaseQuote) {
  const price = quote.price.trim();
  if (!price) return quote.condition === 'new';
  return /^\d+(\.\d{1,2})?$/.test(price) && amount(price) !== null;
}
export function applyPurchaseQuote(item: PlanItem, quote?: PurchaseQuote): PlanItem {
  if (!quote) return item;
  if (!validPurchaseQuote(quote)) throw new Error('Invalid purchase quote');
  return {
    ...item,
    price: quote.price.trim(),
    ...(quote.sales || item.sales
      ? { sales: { ...(quote.sales || item.sales)!, condition: quote.condition } }
      : {}),
    variant: [
      item.variant,
      quote.condition === 'used' ? '二手购入' : quote.condition === 'takeoff' ? '拆车件' : '',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}
export function amount(s: string): number | null {
  if (!/^\d+(\.\d{0,3})?$/.test(s.trim())) return null;
  const n = Number(s);
  return n <= 1000000 ? n : null;
}
export function fitDefaults(): FitSetup {
  return {
    bikeId: '',
    size: '',
    spacers: 20,
    cover: 10,
    stemStack: 40,
    stem: 100,
    angle: -6,
    barReach: 75,
    saddleHeight: 720,
    setback: 180,
  };
}
export function newPlan(mode: Plan['mode'] = 'upgrade'): Plan {
  return {
    schema: 'velodex.studio',
    version: 1,
    title: mode === 'upgrade' ? '我的升级方案' : '我的装车方案',
    mode,
    bikeId: '',
    bikeName: '',
    size: '',
    paintId: '',
    baselineWeight: '',
    budget: '',
    labor: '',
    consumables: '',
    resale: '',
    weightAligned: false,
    items: [],
    notes: '',
    calibration: null,
    visual: { depth: 45, rearDepth: 45, tire: 28, sidewall: 'black', diameter: 622 },
    interfaces: { axle: '', rotor: '', freehub: '', crank: '' },
    fit: { a: fitDefaults(), b: fitDefaults() },
  };
}
export function selectBike(p: Plan, b?: Bike): Plan {
  return {
    ...p,
    bikeId: b?.id || '',
    bikeName: b ? `${b.name} · ${b.edition}` : '',
    size: b?.geometry.defaultSize || '',
    paintId: '',
    baselineWeight: '',
    calibration: null,
    resale: '',
    weightAligned: false,
    interfaces: newPlan().interfaces,
    items: p.items.filter((i) => i.action === 'buy'),
    fit: { ...p.fit, a: { ...p.fit.a, bikeId: b?.id || '', size: b?.geometry.defaultSize || '' } },
  };
}
export function productItem(p: Product): PlanItem {
  return {
    key: crypto.randomUUID(),
    productId: p.id,
    category: p.category,
    name: p.name,
    variant: p.price?.scope || p.era,
    action: 'buy',
    quantity: p.category === 'tires' && p.id !== 'aero111' ? 2 : 1,
    price: '',
    weight: p.selection?.weightG ? String(p.selection.weightG) : '',
    weightScope: p.selection?.weightScope || '',
    source: p.source,
    reference: p.price,
    sales: initialSales(productProfile(p)),
    onBike: !['shoes', 'cleats'].includes(p.category) && p.selection?.sensor !== 'heart',
  };
}
export function wheelDepths(p: Product) {
  if (p.category !== 'wheels') return null;
  const values = p.specs
    .find(([k]) => k === '框高')?.[1]
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number);
  if (!values?.length || values.length > 2 || values.some((n) => n < 15 || n > 100)) return null;
  return { depth: values[0], rearDepth: values[1] ?? values[0] };
}
export function customItem(category: Category = 'other'): PlanItem {
  return {
    key: crypto.randomUUID(),
    productId: '',
    category,
    name: '',
    variant: '',
    action: 'buy',
    quantity: 1,
    price: '',
    weight: '',
    onBike: !['shoes', 'cleats'].includes(category),
    weightScope: '',
    source: '',
  };
}
export function unitPrice(i: PlanItem) {
  if (i.sales && i.sales.condition !== 'new' && !i.price.trim()) return null;
  return i.price.trim()
    ? amount(i.price)
    : i.reference?.currency === 'CNY'
      ? i.reference.amount
      : null;
}
export function estimate(p: Plan) {
  const buys = p.items.filter((i) => i.action === 'buy');
  const missingPrices = buys.filter((i) => unitPrice(i) === null);
  const subtotal = buys.reduce((sum, i) => sum + (unitPrice(i) ?? 0) * i.quantity, 0);
  const labor = amount(p.labor),
    consumables = amount(p.consumables),
    resale = p.mode === 'upgrade' ? amount(p.resale) : 0;
  const missingFees = [
    labor === null && '工时与运费',
    consumables === null && '安装件与耗材',
    p.mode === 'upgrade' && resale === null && '旧件转售',
  ].filter(Boolean) as string[];
  const gross = subtotal + (labor ?? 0) + (consumables ?? 0),
    net = gross - (resale ?? 0);
  const bikeItems = p.items.filter(
    (i) => i.onBike && (p.mode === 'build' ? i.action !== 'remove' : i.action !== 'keep'),
  );
  const missingWeights = bikeItems.filter((i) => amount(i.weight) === null);
  const delta = bikeItems.reduce(
    (sum, i) => sum + (amount(i.weight) ?? 0) * i.quantity * (i.action === 'remove' ? -1 : 1),
    0,
  );
  const base = amount(p.baselineWeight);
  const weight =
    bikeItems.length &&
    !missingWeights.length &&
    (p.mode === 'build' || (base !== null && p.weightAligned))
      ? (p.mode === 'build' ? 0 : base!) + delta
      : null;
  return {
    subtotal,
    gross,
    net,
    missingPrices,
    missingFees,
    priced: buys.length - missingPrices.length,
    priceComplete: buys.length > 0 && !missingPrices.length && !missingFees.length,
    delta,
    weight: weight !== null && weight > 0 ? weight : null,
    missingWeights,
    coverage:
      p.mode === 'build'
        ? [
            'frame',
            'wheels',
            'groupsets',
            'tires',
            'handlebars',
            'seatposts',
            'saddles',
            'pedals',
          ].filter((c) => !p.items.some((i) => i.category === c && i.action !== 'remove'))
        : [],
  };
}
export function checks(p: Plan, parts: PartsCatalog) {
  const selected = p.items.filter((i) => i.action !== 'remove' && i.productId);
  const state = {
    ...initialAdvisor(),
    bike: p.bikeName,
    crank: p.interfaces.crank,
    freehub: p.interfaces.freehub || 'unknown',
    rotor: p.interfaces.rotor || 'unknown',
    axle: p.interfaces.axle || 'unknown',
    needHeart: false,
    needCadence: false,
    needSpeed: false,
    picks: selected.map((i) => ({
      id: i.productId,
      price: i.price,
      quantity: i.quantity,
      version: i.variant,
    })),
  };
  // Generic wheel prompts are replaced with evidence-specific checks below.
  const notes = planAdvice(state, parts.products).filter(
    (x) => !x.text.startsWith('轮组尚需') && !x.text.startsWith('轮圈胎圈'),
  );
  for (const [category, name] of categories) {
    if (['sensors', 'other', 'tires', 'cleats'].includes(category)) continue;
    if (
      p.items
        .filter((i) => i.category === category && i.action !== 'remove')
        .reduce((n, i) => n + i.quantity, 0) > 1
    )
      notes.push({
        level: 'conflict',
        text: `${name}有多件同时装车：请将替下的零件设为“拆下”，或另存为第二套方案。`,
      });
  }
  const wheel = selected
    .map((i) => parts.products.find((x) => x.id === i.productId))
    .find((x) => x?.category === 'wheels');
  const tires = selected
    .map((i) => parts.products.find((x) => x.id === i.productId))
    .filter((x) => x?.category === 'tires');
  if (wheel) {
    const spec = wheel.specs.map(([k, v]) => `${k}：${v}`).join('；');
    if (
      /无钩/.test(spec) &&
      tires.some((t) => t!.specs.some(([k, v]) => k === '胎圈适配' && v.includes('有钩')))
    )
      notes.push({
        level: 'conflict',
        text: '所选开口胎仅适用有钩轮圈，不能搭配这款无钩轮组。依据：轮组胎圈结构与轮胎适配规格。',
      });
    for (const [field, title, pattern] of [
      ['rotor', '碟片接口', /Center Lock|六钉/],
      ['axle', '轴端', /12×100 \/ 后 12×142|12×100 \/ 12×142/],
    ] as const) {
      const recorded = spec.match(pattern)?.[0]?.replace(' / 后 ', ' / ');
      const current = p.interfaces[field];
      if (recorded && current && recorded !== current)
        notes.push({
          level: 'conflict',
          text: `${title}不一致：所选轮组记录为 ${recorded}，现车填写为 ${current}。需要对应转换件或另一规格，不能直接认定可安装。`,
        });
      else if (recorded && current)
        notes.push({
          level: 'info',
          text: `${title}记录一致（${recorded}）；现车规格来自你的填写，轮组依据其资料页。`,
        });
      else
        notes.push({
          level: 'check',
          text: `${title}：${recorded ? `轮组为 ${recorded}，请补充现车接口` : '所收录资料未覆盖具体销售版本，请核对所购规格'}。`,
        });
    }
    notes.push({
      level: 'check',
      text: '轮组还需按所购版本核对塔基、飞轮速别、胎宽表、系统限重与碟片位置；现有规则不覆盖所有装配条件。',
    });
  }
  if (p.items.some((i) => !i.productId))
    notes.push({
      level: 'check',
      text: '自定义零件已计入清单，其安装条件需要按所填型号和资料核对。',
    });
  return notes;
}
export function fitCoordinates(s: FitSetup, catalog: Catalog) {
  const g = catalog.bikes
    .find((b) => b.id === s.bikeId)
    ?.geometry.sizes.find((g) => g.size === s.size);
  if (!g || s.saddleHeight <= s.setback) return null;
  const a = (g.headAngle * Math.PI) / 180,
    stemAngle = ((90 - g.headAngle + s.angle) * Math.PI) / 180;
  const rise = s.cover + s.spacers + s.stemStack / 2;
  const clamp = {
    x: g.reach - Math.cos(a) * rise + Math.cos(stemAngle) * s.stem,
    y: g.stack + Math.sin(a) * rise + Math.sin(stemAngle) * s.stem,
  };
  return {
    g,
    clamp,
    bar: { x: clamp.x + s.barReach, y: clamp.y },
    saddle: { x: -s.setback, y: Math.sqrt(s.saddleHeight ** 2 - s.setback ** 2) },
  };
}

// Imported links/files are untrusted. Rebuild a whitelisted object and reject malformed fields.
export function parsePlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  try {
    if (new TextEncoder().encode(JSON.stringify(raw)).length > 256 * 1024) return null;
  } catch {
    return null;
  }
  const p = raw as Plan;
  const str = (v: unknown, max = 200) => typeof v === 'string' && v.length <= max;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const numeric = (v: unknown) => str(v, 24) && (v === '' || amount(v as string) !== null);
  const source = (v: unknown) => str(v, 2000) && (v === '' || /^https?:\/\//.test(v as string));
  if (p.schema !== 'velodex.studio' || p.version !== 1 || !['upgrade', 'build'].includes(p.mode))
    return null;
  if (!['title', 'bikeId', 'bikeName', 'size', 'paintId'].every((k) => str(p[k as keyof Plan])))
    return null;
  if (
    !['baselineWeight', 'budget', 'labor', 'consumables', 'resale'].every((k) =>
      numeric(p[k as keyof Plan]),
    ) ||
    !str(p.notes, 3000) ||
    typeof p.weightAligned !== 'boolean'
  )
    return null;
  if (
    !p.interfaces ||
    !['axle', 'rotor', 'freehub', 'crank'].every((k) =>
      str(p.interfaces[k as keyof Plan['interfaces']]),
    )
  )
    return null;
  if (!Array.isArray(p.items) || p.items.length > 60) return null;
  const items: PlanItem[] = [];
  for (const i of p.items) {
    if (!i || typeof i !== 'object' || Array.isArray(i)) return null;
    const sales = i.sales === undefined ? undefined : parseSales(i.sales);
    if (sales === null) return null;
    if (
      !i ||
      !str(i.key, 80) ||
      !str(i.productId) ||
      !str(i.name) ||
      !str(i.variant, 400) ||
      !str(i.weightScope, 500) ||
      !source(i.source) ||
      !categories.some(([c]) => c === i.category) ||
      !['buy', 'keep', 'remove'].includes(i.action) ||
      !num(i.quantity, 1, 20) ||
      !Number.isInteger(i.quantity) ||
      !numeric(i.price) ||
      !numeric(i.weight) ||
      typeof i.onBike !== 'boolean'
    )
      return null;
    const r = i.reference;
    if (
      r &&
      (!num(r.amount, 0, 1000000) ||
        !['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'CAD'].includes(r.currency) ||
        !['official', 'launch', 'distributor'].includes(r.kind) ||
        !source(r.source) ||
        ![r.market, r.scope, r.note, r.checkedAt].every((v) => str(v, 2000)))
    )
      return null;
    items.push({
      key: i.key,
      productId: i.productId,
      name: i.name,
      category: i.category,
      variant: i.variant,
      action: i.action,
      quantity: i.quantity,
      price: i.price,
      weight: i.weight,
      weightScope: i.weightScope,
      source: i.source,
      onBike: i.onBike,
      ...(sales ? { sales } : {}),
      ...(r
        ? {
            reference: {
              amount: r.amount,
              currency: r.currency,
              market: r.market,
              scope: r.scope,
              kind: r.kind,
              note: r.note,
              source: r.source,
              checkedAt: r.checkedAt,
            },
          }
        : {}),
    });
  }
  if (new Set(items.map((i) => i.key)).size !== items.length) return null;
  const v = p.visual;
  if (
    !v ||
    !num(v.depth, 15, 100) ||
    !num(v.rearDepth ?? v.depth, 15, 100) ||
    !num(v.tire, 20, 65) ||
    ![559, 584, 622].includes(v.diameter) ||
    !['black', 'tan'].includes(v.sidewall)
  )
    return null;
  const point = (v: Point) => v && num(v.x, 0, 1) && num(v.y, 0, 1);
  if (
    p.calibration &&
    (![p.calibration.rear, p.calibration.front, p.calibration.edge].every(point) ||
      !num(p.calibration.radiusMm, 250, 400))
  )
    return null;
  const validFit = (s: FitSetup) =>
    s &&
    str(s.bikeId) &&
    str(s.size) &&
    num(s.spacers, 0, 80) &&
    num(s.cover, 0, 50) &&
    num(s.stemStack, 10, 70) &&
    num(s.stem, 30, 200) &&
    num(s.angle, -40, 40) &&
    num(s.barReach, 0, 150) &&
    num(s.saddleHeight, 400, 1100) &&
    num(s.setback, 0, 350);
  if (!p.fit || !validFit(p.fit.a) || !validFit(p.fit.b)) return null;
  const fit = (s: FitSetup): FitSetup => ({
    bikeId: s.bikeId,
    size: s.size,
    spacers: s.spacers,
    cover: s.cover,
    stemStack: s.stemStack,
    stem: s.stem,
    angle: s.angle,
    barReach: s.barReach,
    saddleHeight: s.saddleHeight,
    setback: s.setback,
  });
  return {
    schema: 'velodex.studio',
    version: 1,
    title: p.title,
    mode: p.mode,
    bikeId: p.bikeId,
    bikeName: p.bikeName,
    size: p.size,
    paintId: p.paintId,
    baselineWeight: p.baselineWeight,
    budget: p.budget,
    labor: p.labor,
    consumables: p.consumables,
    resale: p.resale,
    weightAligned: p.weightAligned,
    notes: p.notes,
    items,
    calibration: p.calibration
      ? {
          rear: { x: p.calibration.rear.x, y: p.calibration.rear.y },
          front: { x: p.calibration.front.x, y: p.calibration.front.y },
          edge: { x: p.calibration.edge.x, y: p.calibration.edge.y },
          radiusMm: p.calibration.radiusMm,
        }
      : null,
    visual: {
      depth: v.depth,
      rearDepth: v.rearDepth ?? v.depth,
      tire: v.tire,
      sidewall: v.sidewall,
      diameter: v.diameter,
    },
    interfaces: {
      axle: p.interfaces.axle,
      rotor: p.interfaces.rotor,
      freehub: p.interfaces.freehub,
      crank: p.interfaces.crank,
    },
    fit: { a: fit(p.fit.a), b: fit(p.fit.b) },
  };
}
export function encodePlan(p: Plan) {
  return btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(p)), (b) => String.fromCharCode(b)).join(''),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export function decodePlan(s: string) {
  if (s.length > 100000 || !/^[\w-]+$/.test(s)) return null;
  try {
    return parsePlan(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
        ),
      ),
    );
  } catch {
    return null;
  }
}
export function planText(p: Plan) {
  const t = estimate(p);
  return [
    p.title,
    p.mode === 'build' ? '从零装车' : `现车：${p.bikeName || '自定义车辆'}`,
    p.size && `尺码：${p.size}`,
    ...p.items.map(
      (i) =>
        `${{ buy: '购入', keep: '沿用', remove: '拆下' }[i.action]} · ${i.name || label(i.category)} × ${i.quantity}\n规格：${i.variant || '自定义'}；${i.sales ? salesText(i.sales) + '\n' : ''}${i.action === 'buy' ? `人民币单价：${unitPrice(i) === null ? '未计价' : money(unitPrice(i)!)}` : '本次不采购'}\n${i.reference ? `${i.reference.market} / ${i.reference.currency} ${i.reference.amount} / ${i.reference.scope} / ${i.reference.checkedAt}\n${i.reference.source}` : i.source}`,
    ),
    `工时运费：${p.labor || '未计入'}；安装耗材：${p.consumables || '未计入'}；旧件转售：${p.mode === 'build' ? '不适用' : p.resale || '未计入'}`,
    `${t.priceComplete ? '净支出估算' : '已知净支出'}：${money(t.net)}`,
    t.weight !== null
      ? `${p.mode === 'build' ? '所列车上零件合计' : '升级后估重'}：${(t.weight / 1000).toFixed(3)} kg`
      : '重量未完整计算',
    `不含未列零件与未计价项目；参考价不代表成交价。`,
    p.notes,
  ]
    .filter(Boolean)
    .join('\n\n');
}
