export const slots = [
  ['frame', '车架组', '含前叉、碗组与座管'],
  ['groupset', '变速与制动', '含曲柄、牙盘、飞轮、链条、夹器、碟片与中轴'],
  ['wheels', '轮组', '前后轮一对'],
  ['tires', '轮胎', '前后胎一对'],
  ['cockpit', '车把与把立', '含把带'],
  ['saddle', '坐垫', '不重复计入座管'],
  ['pedals', '脚踏', '左右一对'],
  ['extras', '其余小件', '内胎 / 密封液、阀嘴、贯通轴等未计入项目'],
] as const;
export type Slot = (typeof slots)[number][0];
// A standalone handlebar or seatpost does not cover the scope of a complete build slot.
export function partSlot(category: string): Slot | undefined {
  switch (category) {
    case 'groupsets':
      return 'groupset';
    case 'wheels':
      return 'wheels';
    case 'tires':
      return 'tires';
    case 'saddles':
      return 'saddle';
    default:
      return undefined;
  }
}
export type BuildItem = {
  choice: string;
  custom: string;
  grams: string;
  yuan: string;
  checked: boolean;
  weightMode?: 'auto' | 'manual' | 'skip';
  weightVariant?: string;
};
export type DreamBuild = {
  version: 1;
  title: string;
  bikeId: string;
  paintId: string;
  items: Record<Slot, BuildItem>;
};
export function newBuild(bikeId = 'tarmac-sl8'): DreamBuild {
  return {
    version: 1,
    title: '我的梦幻装车单',
    bikeId,
    paintId: 'default',
    items: Object.fromEntries(
      slots.map(([id]) => [
        id,
        {
          choice: '',
          custom: '',
          grams: '',
          yuan: '',
          checked: false,
          weightMode: 'auto',
          weightVariant: '',
        },
      ]),
    ) as DreamBuild['items'],
  };
}
export function amount(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 10000000 ? n : null;
}
export function totals(build: DreamBuild, key: 'grams' | 'yuan') {
  const numbers = slots.map(([slot]) =>
    key === 'grams' ? weightOf(build.items[slot]).grams : amount(build.items[slot][key]),
  );
  return {
    value: numbers.reduce<number>((sum, n) => sum + (n ?? 0), 0),
    known: numbers.filter((n) => n !== null).length,
    total: slots.length,
  };
}
export function parseBuild(value: unknown): DreamBuild {
  if (!value || typeof value !== 'object') throw new Error('装车单格式不正确');
  const b = value as DreamBuild;
  const text = (s: unknown, max: number) => typeof s === 'string' && s.length <= max;
  if (
    b.version !== 1 ||
    !text(b.title, 50) ||
    !text(b.bikeId, 80) ||
    !text(b.paintId, 80) ||
    !b.items
  )
    throw new Error('装车单格式不正确');
  const result = newBuild(b.bikeId);
  result.title = b.title;
  result.paintId = b.paintId;
  for (const [slot] of slots) {
    const i = b.items[slot];
    if (
      !i ||
      !text(i.choice, 80) ||
      !text(i.custom, 100) ||
      !text(i.grams, 16) ||
      !text(i.yuan, 16) ||
      typeof i.checked !== 'boolean' ||
      (i.weightMode !== undefined && !['auto', 'manual', 'skip'].includes(i.weightMode)) ||
      (i.weightVariant !== undefined && !text(i.weightVariant, 80)) ||
      (i.grams.trim() !== '' && amount(i.grams) === null) ||
      (i.yuan.trim() !== '' && amount(i.yuan) === null)
    )
      throw new Error('装车单项目不正确');
    result.items[slot] = {
      choice: i.choice,
      custom: i.custom,
      grams: i.grams,
      yuan: i.yuan,
      checked: i.checked,
      weightMode: i.weightMode ?? (i.grams.trim() ? 'manual' : 'auto'),
      weightVariant: i.weightVariant || '',
    };
  }
  return result;
}
export function encodeBuild(build: DreamBuild) {
  const publicBuild = parseBuild(build);
  // Purchase progress stays in the local checklist; the public link shares the specification.
  for (const [slot] of slots) publicBuild.items[slot].checked = false;
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(publicBuild))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export function decodeBuild(encoded: string) {
  if (encoded.length > 14000) throw new Error('分享链接过长');
  return parseBuild(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ),
  );
}
export function gear(front: number, rear: number, circumference: number, cadence: number) {
  if (
    !Number.isInteger(front) ||
    !Number.isInteger(rear) ||
    ![front, rear, circumference, cadence].every(Number.isFinite) ||
    front < 1 ||
    rear < 1 ||
    circumference <= 0 ||
    cadence < 0
  )
    return null;
  const ratio = front / rear;
  const development = (ratio * circumference) / 1000;
  return { ratio, development, speed: (development * cadence * 60) / 1000 };
}
export type WheelFit = {
  inner: number;
  hookless: boolean;
  freehubs: string[];
  grams?: number;
  weightNote?: string;
};
export const wheelFit: Record<string, WheelFit> = {
  'dt-arc1100-65': {
    inner: 22,
    hookless: false,
    freehubs: ['HG', 'XDR'],
    grams: 1520,
    weightNote: '官方前后轮 707 + 813 g；轮组口径以产品页为准',
  },
  'zipp-404-firecrest': {
    inner: 23,
    hookless: true,
    freehubs: ['HG', 'XDR'],
    grams: 1559,
    weightNote: '官方 XDR 最低重量，不含胎垫与阀嘴',
  },
  'zipp-303-firecrest': {
    inner: 25,
    hookless: true,
    freehubs: ['HG', 'XDR'],
    grams: 1408,
    weightNote: '官方 XDR 重量，不含胎垫与阀嘴',
  },
  'enve-ses45': {
    inner: 25,
    hookless: true,
    freehubs: ['HG', 'XDR'],
    grams: 1493,
    weightNote: '官方表格值，含胎垫与阀嘴',
  },
  'roval-rapide-clx3': {
    inner: 21,
    hookless: false,
    freehubs: ['HG', 'XDR'],
    grams: 1305,
    weightNote: '官方一对重量，含胎垫与阀嘴',
  },
  'shimano-c50': { inner: 21, hookless: false, freehubs: ['HG L2'] },
};
export type WeightReference = {
  id: string;
  label: string;
  grams: number;
  note: string;
  source: string;
  checkedAt: string;
};
const wheelSources: Record<string, string> = {
  'dt-arc1100-65': 'https://www.dtswiss.com/en/wheels/wheels-road/aero/arc-1100-dicut-db',
  'zipp-404-firecrest': 'https://www.sram.com/en/zipp/models/wh-404-ftld-b1',
  'zipp-303-firecrest': 'https://www.sram.com/en/service/models/wh-303-ftld-a1',
  'enve-ses45': 'https://enve.com/products/ses-4-5',
  'roval-rapide-clx3': 'https://www.specialized.com/us/en/roval-rapide-clx-iii/p/1000256237',
};
const tireReference = (
  id: string,
  label: string,
  each: number,
  source: string,
): WeightReference => ({
  id,
  label,
  grams: each * 2,
  source,
  checkedAt: '2026-09-20',
  note: `官方单条 ${each} g × 2；仅含两条外胎，不含内胎、密封液、胎垫或阀嘴。`,
});
export const weightReferences: Record<string, WeightReference[]> = {
  'lun-hyper3-d45': [
    {
      id: 'default',
      label: 'D45 碟刹 · 前后轮一对',
      grams: 1334,
      note: '官方一对标称 1,334 g，公差 ±50 g；具体塔基及附件范围以实物版本为准。',
      source: 'https://www.winspace.cc/product/hyper-3-d45-disc-brake-wheelset/',
      checkedAt: '2026-09-24',
    },
  ],
  'vision-metron45-rs': [
    {
      id: 'default',
      label: '45 RS 碟刹 · 前后轮一对',
      grams: 1290,
      note: '官方标称一对 1,290 g；产品页未完整说明附件称重范围。',
      source: 'https://shop.visiontechusa.com/fr/wheelsets/road-triathlon/metron-45-rs',
      checkedAt: '2026-09-24',
    },
  ],
  'vittoria-corsa-next': [
    [24, 265],
    [26, 280],
    [28, 305],
    [30, 320],
    [32, 340],
    [34, 350],
  ].map(([width, grams]) => ({
    ...tireReference(
      `${width}-black`,
      `${width}-622 黑色 TLR · 两条`,
      grams,
      'https://vittoria.com/products/corsa-n-ext-tubeless-ready',
    ),
    checkedAt: '2026-09-24',
  })),
  'prologo-scratch-m5': [
    ['nack', 'Nack 碳弓', 153],
    ['tirox', 'Tirox 合金钢弓', 214],
  ].map(([id, label, grams]) => ({
    id: String(id),
    label: String(label),
    grams: Number(grams),
    note: '250 × 140 mm；采用当前官方页面对应座弓版本重量，仅含坐垫。',
    source: 'https://prologo.it/en/products/scratch-m5',
    checkedAt: '2026-09-24',
  })),
  'slr-boost-ti316': [
    ['s3', 'S3 · 130 mm', 158],
    ['l3', 'L3 · 145 mm', 164],
  ].map(([id, label, grams]) => ({
    id: String(id),
    label: String(label),
    grams: Number(grams),
    note: 'TI 316 圆弓 / Superflow；官方公差 ±8%，仅含坐垫。',
    source: 'https://it.selleitalia.com/slr-boost-ti-316-superflow/?setCurrencyId=2',
    checkedAt: '2026-09-24',
  })),
  ...Object.fromEntries(
    Object.entries(wheelFit)
      .filter(([, w]) => w.grams)
      .map(([id, w]) => [
        id,
        [
          {
            id: 'default',
            label: '前后轮一对',
            grams: w.grams!,
            note: w.weightNote!,
            source: wheelSources[id],
            checkedAt: '2026-09-20',
          },
        ],
      ]),
  ),
  'schwalbe-pro-one': [
    tireReference(
      '28-black',
      '28-622 黑色 · 11653975 · 两条',
      295,
      'https://www.schwalbe.com/en/PRO-One-Tubeless-11653975',
    ),
  ],
  'vittoria-corsa-pro': [
    [24, 245],
    [26, 260],
    [28, 280],
    [29, 290],
    [30, 285],
    [32, 305],
  ].map(([width, grams]) =>
    tireReference(
      `${width}-para`,
      `${width}-622${width === 29 ? ' WR' : ''} Para · 两条`,
      grams,
      'https://vittoria.com/products/corsa-pro-tubeless-ready',
    ),
  ),
  'pirelli-race-tlr-rs': [
    [26, 270],
    [28, 290],
    [30, 310],
    [32, 340],
    [35, 370],
  ].map(([width, grams]) =>
    tireReference(
      `${width}-black`,
      `${width}-622 标准黑色 · 两条`,
      grams,
      'https://www.pirelli.com/tires/en-us/bike/tires/catalogue/p-zero-race-tlr-rs',
    ),
  ),
};
export function defaultWeightVariant(choice: string) {
  const refs = weightReferences[choice] || [];
  return (refs.find((r) => r.id.startsWith('28-')) || refs[0])?.id || '';
}
export function weightReference(item: BuildItem) {
  const refs = weightReferences[item.choice] || [];
  // Older tire selections did not record width or casing; never infer a SKU on migration.
  const id = item.weightVariant || (wheelFit[item.choice] ? 'default' : '');
  return refs.find((r) => r.id === id);
}
export function weightOf(item: BuildItem): {
  grams: number | null;
  origin: 'official' | 'manual' | 'unknown' | 'skip';
  reference?: WeightReference;
} {
  const mode = item.weightMode ?? (item.grams.trim() ? 'manual' : 'auto');
  const reference = weightReference(item);
  if (mode === 'skip') return { grams: null, origin: 'skip', reference };
  if (mode === 'manual')
    return {
      grams: amount(item.grams),
      origin: amount(item.grams) === null ? 'unknown' : 'manual',
      reference,
    };
  return reference
    ? { grams: reference.grams, origin: 'official', reference }
    : { grams: null, origin: 'unknown' };
}
export function weightBreakdown(build: DreamBuild) {
  const weights = slots.map(([s]) => weightOf(build.items[s]));
  return {
    official: weights.filter((w) => w.origin === 'official').length,
    manual: weights.filter((w) => w.origin === 'manual').length,
    skipped: weights.filter((w) => w.grams === null).length,
  };
}

export function fitCheck(wheelId: string, tireId: string) {
  const wheel = wheelFit[wheelId];
  if (!wheelId || !tireId)
    return { level: 'unknown', title: '先选择轮组与轮胎', text: '比较胎圈结构与厂商资料。' };
  if (!wheel)
    return {
      level: 'unknown',
      title: '这款轮组的兼容资料尚待核对',
      text: '尚未收录完整的胎圈与适配资料。请查阅轮组和轮胎厂商的具体版本说明，不能据此判断兼容。',
    };
  if (wheel.hookless && tireId === 'gp5000-clincher')
    return {
      level: 'blocked',
      title: '不匹配：开口胎不能用于无钩轮圈',
      text: '这里的 GP 5000 是有内胎开口版，不是 S TR。添加内胎也不会让它获得无钩兼容性。',
    };
  return {
    level: 'review',
    title: '仍需核对具体规格',
    text: `${wheel.inner} mm 内宽 · ${wheel.hookless ? '无钩轮圈。确认该轮组批准的轮胎型号、胎宽与压力上限；不能只看“真空胎”三个字。' : '有钩轮圈。仍需核对所选胎宽、轮圈适配范围和压力上限。'} 装车后实测胎宽还需满足车架间隙要求。`,
  };
}
export function upgrade(before: number | null, after: number | null, cost: number | null) {
  if (before === null || after === null) return null;
  const saved = before - after;
  return {
    saved,
    percent: before > 0 ? (saved / before) * 100 : null,
    yuanPerGram: saved > 0 && cost !== null ? cost / saved : null,
  };
}
