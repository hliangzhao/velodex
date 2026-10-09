import type { Product } from '../types';
import type { FrameOption } from './library';
import type { Category, PlanItem } from './model';

export type Condition = 'new' | 'takeoff' | 'used';
export const conditionLabels = { new: '新品', takeoff: '拆车件', used: '二手' };
export type SalesSelection = {
  profileId: string;
  market: string;
  condition: Condition;
  attributes: Record<string, string>;
  scope: string;
  included: string;
  excluded: string;
};
export type SalesField = { key: string; label: string; options?: string[]; value?: string };
export type SalesProfile = {
  id: string;
  name: string;
  market: string;
  scope: string;
  source: string;
  checkedAt: string;
  fields: SalesField[];
  facts: [string, string][];
};
const definitions: Record<Category, [string, string][]> = {
  frame: [
    ['size', '车架尺码'],
    ['paint', '涂装'],
    ['cockpit', '把组与座管版本'],
  ],
  wheels: [
    ['freehub', '塔基'],
    ['axle', '前后轴端'],
    ['rotor', '碟片接口'],
  ],
  groupsets: [
    ['speed', '速别与代次'],
    ['crank', '曲柄长度'],
    ['chainring', '牙盘齿数'],
    ['cassette', '飞轮齿数'],
  ],
  tires: [
    ['size', '轮胎尺寸'],
    ['color', '胎侧颜色'],
  ],
  handlebars: [
    ['width', '把宽'],
    ['length', '把立长度 / 分体把'],
    ['adapter', '车架上盖与走线配套'],
  ],
  seatposts: [
    ['diameter', '直径或专用截面'],
    ['length', '长度与后飘'],
    ['clamp', '座弓夹具'],
  ],
  saddles: [
    ['width', '坐垫宽度'],
    ['rail', '座弓规格'],
  ],
  powermeters: [
    ['interface', '轴心或盘爪接口'],
    ['crank', '曲柄长度 / 仅盘爪或脚踏'],
    ['chainring', '盘片配置'],
  ],
  computers: [
    ['edition', '销售版本'],
    ['bundle', '单机或套装'],
  ],
  pedals: [
    ['spindle', '轴长版本'],
    ['cleat', '锁片制式'],
  ],
  cleats: [['system', '锁片制式与浮动角度']],
  shoes: [
    ['size', '鞋码'],
    ['last', '鞋楦'],
    ['color', '颜色'],
  ],
  sensors: [['edition', '版本与随附配件']],
  other: [['specification', '尺寸与型号']],
};
export function categoryFields(category: Category): SalesField[] {
  return definitions[category].map(([key, label]) => ({ key, label }));
}
export function productProfile(p: Product): SalesProfile {
  const fields = categoryFields(p.category);
  const spec = (key: string) => p.specs.find(([k]) => k === key)?.[1];
  const set = (key: string, value?: string) => {
    const f = fields.find((f) => f.key === key);
    if (f && value) f.value = value;
  };
  // Only promote explicit catalogue facts; prose mentioning possible interfaces
  // is not evidence that a particular sale version supplies them.
  set('rotor', spec('碟片接口'));
  const plateInterface = spec('盘片接口');
  set(
    'interface',
    spec('轴心') ||
      (plateInterface && !/等|或|多种|版本|可选/.test(plateInterface) ? plateInterface : undefined),
  );
  set('cleat', p.selection?.cleat);
  if (p.category === 'cleats')
    set('system', [spec('锁踏制式'), spec('浮动角度')].filter(Boolean).join(' · '));
  if (p.category === 'computers') set('edition', spec('版本范围'));
  if (p.id === 'magene-teo-p515')
    fields.find((f) => f.key === 'crank')!.options = [
      '160',
      '165',
      '167.5',
      '170',
      '172.5',
      '175',
    ].map((n) => `${n} mm`);
  if (p.id === 'farsports-f1s') {
    fields.find((f) => f.key === 'width')!.options = ['360', '380', '400', '420'].map(
      (n) => `${n} mm`,
    );
    fields.find((f) => f.key === 'length')!.options = ['80', '90', '100', '110', '120'].map(
      (n) => `${n} mm`,
    );
  }
  if (p.id === 'gp5000-str' || p.id === 'gp5000-clincher') {
    fields.find((f) => f.key === 'size')!.options = (
      p.id === 'gp5000-str' ? [25, 28, 30, 32] : [23, 25, 28, 32]
    ).map((n) => `700 × ${n}C`);
  }
  return {
    id: p.id,
    name: p.name,
    market: p.price?.market || '',
    scope: p.price?.scope || spec('销售范围') || spec('销售配置') || spec('套装范围') || '',
    source: p.source,
    checkedAt: p.checkedAt,
    fields,
    facts: p.specs,
  };
}
export function frameProfile(f: FrameOption): SalesProfile {
  return {
    id: f.id,
    name: f.name,
    market: f.market,
    scope: f.price?.scope || '车架组',
    source: f.source,
    checkedAt: f.checkedAt,
    facts: f.specs,
    fields: [
      { key: 'size', label: '车架尺码', options: f.sizes },
      { key: 'paint', label: '涂装', options: f.paints },
      { key: 'cockpit', label: '把组与座管版本' },
    ],
  };
}
export function initialSales(profile?: SalesProfile): SalesSelection {
  return {
    profileId: profile?.id || '',
    market: profile?.market || '',
    condition: 'new',
    attributes: Object.fromEntries(
      (profile?.fields || []).filter((f) => f.value).map((f) => [f.key, f.value!]),
    ),
    scope: profile?.scope || '',
    included: '',
    excluded: '',
  };
}
export function salesForItem(item: PlanItem, profile?: SalesProfile): SalesSelection {
  return (
    item.sales || {
      ...initialSales(profile),
      market: profile?.market || item.reference?.market || '',
      scope: profile?.scope || item.reference?.scope || '',
      condition: item.variant.includes('二手购入') ? 'used' : 'new',
    }
  );
}
export function salesText(s: SalesSelection) {
  return [
    s.market,
    conditionLabels[s.condition],
    ...Object.values(s.attributes).filter(Boolean),
    s.scope,
    s.included && `包含：${s.included}`,
    s.excluded && `不含：${s.excluded}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
export function salesGaps(item: PlanItem) {
  const s = item.sales;
  return [
    !item.name.trim() && '型号',
    !s?.market.trim() && '销售地区',
    !s?.scope.trim() && '销售单位与范围',
    ...categoryFields(item.category)
      .filter((f) => !s?.attributes[f.key]?.trim())
      .map((f) => f.label),
  ].filter(Boolean) as string[];
}
export function parseSales(raw: unknown): SalesSelection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as SalesSelection;
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  if (
    !str(s.profileId, 200) ||
    !str(s.market, 200) ||
    !str(s.scope, 600) ||
    !str(s.included, 600) ||
    !str(s.excluded, 600) ||
    !['new', 'takeoff', 'used'].includes(s.condition) ||
    !s.attributes ||
    typeof s.attributes !== 'object' ||
    Array.isArray(s.attributes)
  )
    return null;
  const entries = Object.entries(s.attributes);
  if (
    entries.length > 12 ||
    entries.some(
      ([k, v]) =>
        !/^[a-z]{1,30}$/.test(k) || ['constructor', 'prototype'].includes(k) || !str(v, 300),
    )
  )
    return null;
  return {
    profileId: s.profileId,
    market: s.market,
    condition: s.condition,
    scope: s.scope,
    included: s.included,
    excluded: s.excluded,
    attributes: Object.fromEntries(entries),
  };
}
