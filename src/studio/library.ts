import type { PartsCatalog, Product, ReferencePrice } from '../types';
import prices from '../data/reference-prices.json';
import additions from '../data/frames.json';
import { label, planText, type Plan } from './model';

export type FrameOption = {
  id: string;
  name: string;
  brand: string;
  market: string;
  kind: string;
  source: string;
  checkedAt: string;
  image?: string;
  imageSource?: string;
  imageCaption?: string;
  specs: [string, string][];
  sizes: string[];
  paints: string[];
  ordering: string[];
  price?: ReferencePrice;
};
export const frames: FrameOption[] = [
  ...(additions as FrameOption[]),
  ...Object.entries(prices.frames).map(([id, p]) => ({
    id,
    name: p.name,
    brand: id.startsWith('winspace') ? 'Winspace 银贝斯' : 'Specialized 闪电',
    market: p.market,
    kind: '公路',
    source: p.source,
    checkedAt: p.checkedAt,
    specs: [
      ['销售范围', p.scope],
      ['价格说明', p.note],
    ] as [string, string][],
    sizes: [],
    paints: [],
    ordering: ['车架尺码与涂装', '把组、座管及安装附件的随盒范围'],
    price: p as ReferencePrice,
  })),
];
export type PriceFilter = 'all' | 'cn' | 'foreign' | 'priced';
export function matchesPrice(price: ReferencePrice | undefined, filter: PriceFilter) {
  if (filter === 'cn') return price?.currency === 'CNY' && price.market.includes('中国大陆');
  if (filter === 'foreign')
    return !!price && !(price.currency === 'CNY' && price.market.includes('中国大陆'));
  if (filter === 'priced') return !!price;
  return true;
}
export function findProducts(
  parts: PartsCatalog,
  category: string,
  query: string,
  brand: string,
  price: PriceFilter,
) {
  return parts.products
    .filter(
      (p) =>
        p.category === category &&
        (brand === 'all' || p.brandId === brand) &&
        matchesPrice(p.price, price) &&
        `${p.name} ${p.familyName || ''} ${p.brandId} ${parts.brands.find((b) => b.id === p.brandId)?.name} ${p.specs.flat().join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => Number(matchesPrice(b.price, 'cn')) - Number(matchesPrice(a.price, 'cn')));
}
// Every option keeps its own ID, reference price and technical values in the saved plan.
export function productFamilies(products: Product[]) {
  const result = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.familyId || p.id;
    result.set(key, [...(result.get(key) || []), p]);
  }
  return [...result.entries()];
}

export function orderQuestions(plan: Plan, parts: PartsCatalog) {
  const fallback: Record<string, string[]> = {
    frame: ['尺码与涂装', '座管、车把、碗组和贯通轴的随盒范围'],
    wheels: ['塔基、飞轮速别与轴端', '碟片接口、胎宽表和随盒附件'],
    groupsets: ['准确代次与盘片、飞轮齿数', '曲柄长度、中轴、碟片、电池和充电器是否包含'],
    powermeters: ['曲柄接口、轴心、盘片孔位与曲柄长度', '单边或双边测量，是否包含曲柄与盘片'],
    handlebars: ['把宽、把立长度、上盖和走线规格'],
    seatposts: ['截面、直径、长度、偏移与座弓夹具'],
    saddles: ['宽度、座弓材料和夹持尺寸'],
    tires: ['尺寸、胎圈结构及内胎或真空安装方案'],
    computers: ['单机或传感器套装，地图与保修销售地区'],
    pedals: ['锁片制式，是否随附锁片'],
    shoes: ['鞋码、鞋楦与锁片孔位'],
    cleats: ['锁片制式与浮动角度'],
  };
  return plan.items
    .filter((i) => i.action === 'buy')
    .map((i) => ({
      key: i.key,
      name: i.name || label(i.category),
      questions: parts.products.find((p) => p.id === i.productId)?.ordering ||
        frames.find((f) => f.source === i.source && f.name === i.name)?.ordering ||
        fallback[i.category] || ['具体型号、销售单位与随盒附件'],
    }));
}

export function quoteText(plan: Plan, parts: PartsCatalog) {
  return `${planText(plan)}\n\n请按以下范围提供装车报价\n${orderQuestions(plan, parts)
    .map((i) => `${i.name}\n${i.questions.map((s) => '□ ' + s).join('\n')}`)
    .join(
      '\n\n',
    )}\n\n□ 写明到手价、报价日期与有效期\n□ 分列工时、运费、中轴、转接件、把带及耗材，套餐内已有的部件不重复计价\n□ 列明交期、售后渠道与购买凭证\n□ 若提供重量，注明尺码、涂装与附件范围\n\n此文件由用户选配方案生成，不代表车店报价或装配已经核验。`;
}
