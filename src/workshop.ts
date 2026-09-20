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
export type BuildItem = {
  choice: string;
  custom: string;
  grams: string;
  yuan: string;
  checked: boolean;
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
      slots.map(([id]) => [id, { choice: '', custom: '', grams: '', yuan: '', checked: false }]),
    ) as DreamBuild['items'],
  };
}
export function amount(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 10000000 ? n : null;
}
export function totals(build: DreamBuild, key: 'grams' | 'yuan') {
  const numbers = slots.map(([slot]) => amount(build.items[slot][key]));
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
export function fitCheck(wheelId: string, tireId: string) {
  const wheel = wheelFit[wheelId];
  if (!wheel || !tireId)
    return { level: 'unknown', title: '先选择轮组与轮胎', text: '比较胎圈结构与厂商资料。' };
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
