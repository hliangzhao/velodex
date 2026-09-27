import type { PartCategory, Product, ReferencePrice } from './types';

export const upgradeCategories: { id: PartCategory; name: string }[] = [
  { id: 'wheels', name: '轮组' },
  { id: 'powermeters', name: '功率计' },
  { id: 'computers', name: '码表' },
  { id: 'sensors', name: '传感器' },
  { id: 'pedals', name: '锁踏' },
  { id: 'cleats', name: '锁片' },
  { id: 'shoes', name: '锁鞋' },
  { id: 'tires', name: '轮胎' },
];
export const routes = {
  mixed: '平路与起伏混合',
  flat: '平路巡航',
  climb: '爬坡较多',
  wind: '开阔路段与侧风',
};
export const priorities = {
  balanced: '价格与维护',
  training: '训练与数据',
  weight: '减轻重量',
  speed: '巡航与气动',
};
export type Quote = { id: string; price: string; quantity: number; version: string };
export type AdvisorState = {
  version: 1;
  bike: string;
  bikePrice: string;
  bikeWeight: string;
  budget: string;
  route: keyof typeof routes;
  priority: keyof typeof priorities;
  crank: string;
  freehub: string;
  rotor: string;
  axle: string;
  sale: boolean;
  resaleLow: string;
  resaleHigh: string;
  installation: string;
  adapters: string;
  oldWheelWeight: string;
  newWheelWeight: string;
  sameWeightScope: boolean;
  ownedPower: boolean;
  ownedComputer: boolean;
  ownedHeart: boolean;
  ownedCadence: boolean;
  ownedSpeed: boolean;
  ownedCleat: string;
  ownedShoe: string;
  needHeart: boolean;
  needCadence: boolean;
  needSpeed: boolean;
  picks: Quote[];
};
export function initialAdvisor(): AdvisorState {
  return {
    version: 1,
    bike: '喜德盛 AD7 · M 码（读者示例）',
    bikePrice: '13980',
    bikeWeight: '8440',
    budget: '6000',
    route: 'mixed',
    priority: 'balanced',
    crank: 'FC-R7100 / T47 86-24（示例，需看实车）',
    freehub: 'unknown',
    rotor: 'unknown',
    axle: 'unknown',
    sale: false,
    resaleLow: '1000',
    resaleHigh: '2000',
    installation: '',
    adapters: '',
    oldWheelWeight: '',
    newWheelWeight: '',
    sameWeightScope: false,
    ownedPower: false,
    ownedComputer: false,
    ownedHeart: false,
    ownedCadence: false,
    ownedSpeed: false,
    ownedCleat: 'unknown',
    ownedShoe: 'unknown',
    needHeart: true,
    needCadence: true,
    needSpeed: false,
    picks: [],
  };
}
export function numberOrNull(value: string, max = 1000000): number | null {
  if (!value.trim() || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export function cny(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}
export function priceLabel(p: Product) {
  return p.price ? referencePriceLabel(p.price) : '';
}
export function referencePriceLabel(price: ReferencePrice) {
  const symbols = { CNY: '¥', USD: 'US$', EUR: '€', GBP: '£', JPY: 'JP¥', CAD: 'CA$' };
  const amount = price.amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const kind =
    price.kind === 'launch' ? '发布价' : price.kind === 'distributor' ? '代理商价' : '官网价';
  return `${symbols[price.currency]}${amount} · ${price.market}${kind}`;
}
export function compareReferencePrices(a: Product, b: Product) {
  if (!a.price || !b.price) return a.price ? -1 : b.price ? 1 : 0;
  const order = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'CAD'];
  return (
    order.indexOf(a.price.currency) - order.indexOf(b.price.currency) ||
    a.price.amount - b.price.amount
  );
}
export function quotePrice(q: Quote, p: Product): number | null {
  // Explicit quotes take precedence, including zero. Invalid nonempty quotes do not silently use MSRP.
  return q.price.trim()
    ? numberOrNull(q.price)
    : p.price?.currency === 'CNY'
      ? p.price.amount
      : null;
}
export function costSummary(state: AdvisorState, products: Product[]) {
  let subtotal = 0;
  const missing: string[] = [];
  for (const q of state.picks) {
    const p = products.find((p) => p.id === q.id);
    if (!p) {
      missing.push('已失效的配件');
      continue;
    }
    const value = quotePrice(q, p);
    if (value === null) missing.push(p.name);
    else subtotal += value * q.quantity;
  }
  const wheel = state.picks.some((q) => products.find((p) => p.id === q.id)?.category === 'wheels');
  const applySale = wheel && state.sale;
  const low = numberOrNull(state.resaleLow),
    high = numberOrNull(state.resaleHigh);
  const validSale = !applySale || (low !== null && high !== null && low <= high);
  if (!validSale) missing.push('有效的旧轮组转售价范围');
  const installation = numberOrNull(state.installation),
    adapters = numberOrNull(state.adapters);
  if (state.picks.length) {
    if (installation === null) missing.push('工时 / 运费');
    if (adapters === null) missing.push('适配件 / 耗材');
  }
  const knownCost = subtotal + (installation ?? 0) + (adapters ?? 0);
  const min = knownCost - (applySale && validSale ? high! : 0);
  const max = knownCost - (applySale && validSale ? low! : 0);
  return {
    subtotal,
    min,
    max,
    missing,
    complete: state.picks.length > 0 && !missing.length,
    applySale,
    validSale,
  };
}
export function wheelWeightChange(state: AdvisorState, products: Product[]) {
  const wheels = state.picks.filter(
    (q) => products.find((p) => p.id === q.id)?.category === 'wheels',
  );
  if (wheels.length !== 1 || !state.sameWeightScope) return null;
  const old = numberOrNull(state.oldWheelWeight, 10000),
    next = numberOrNull(state.newWheelWeight, 10000),
    bike = numberOrNull(state.bikeWeight, 100000);
  if (!old || !next || !bike || old >= bike) return null;
  return { saved: old - next, bike: bike - old + next };
}
export type Advice = { level: 'check' | 'conflict' | 'info'; text: string };
export function planAdvice(state: AdvisorState, products: Product[]): Advice[] {
  const chosen = state.picks.flatMap((q) => products.filter((p) => p.id === q.id));
  const out: Advice[] = [];
  const add = (level: Advice['level'], text: string) => out.push({ level, text });
  const power = chosen.filter((p) => p.category === 'powermeters');
  const computer = chosen.find((p) => p.category === 'computers');
  const sensor = (type: string) => chosen.some((p) => p.selection?.sensor === type);
  const hasPower = state.ownedPower || !!power.length;
  const hasCadence =
    state.ownedCadence ||
    sensor('cadence') ||
    state.ownedPower ||
    power.some((p) => p.selection?.cadence);
  if (state.needHeart && !(state.ownedHeart || sensor('heart')))
    add('check', '希望记录心率：还需要心率胸带、臂带或能广播心率的已有设备。');
  if (state.needCadence && !hasCadence)
    add('check', '希望记录踏频：选能输出踏频的功率计，或单独添加踏频传感器。');
  if (state.needSpeed && !(state.ownedSpeed || sensor('speed')))
    add('check', '希望在隧道等环境保留轮速：添加速度传感器并设置实际轮周长。');
  if (hasPower && sensor('cadence'))
    add('info', '功率计通常已输出踏频；单独踏频传感器可能重复，可保留作备件或用于其他车。');
  if (power.length && !(state.ownedComputer || computer))
    add('check', '功率计需要兼容的码表、手机 App 或手表记录数据。');
  if (state.ownedPower && power.length)
    add('info', '已勾选现有功率计，请确认本次是替换还是为另一辆车配置，避免重复购入。');
  if (
    computer &&
    power.some(
      (p) =>
        p.selection?.protocols &&
        computer.selection?.powerProtocols &&
        !p.selection.protocols.some((v) => computer.selection!.powerProtocols!.includes(v)),
    )
  )
    add('conflict', '所选码表与功率计没有共同的已记录功率传输协议。');
  if (power.some((p) => p.selection?.powerType === 'spider'))
    add(
      'check',
      `曲柄填写为「${state.crank || '未知'}」。盘爪必须核对曲柄安装接口、盘片孔位、链线及五通净空；FC-R7100 不能直接换装独立盘爪。`,
    );
  if (power.some((p) => (p.selection?.spindleMm ?? 0) > 28) && /24|R7100/i.test(state.crank))
    add(
      'check',
      '所选功率曲柄采用约 29 mm 轴心；当前填写的是 24 mm 系统，需要另核对中轴和改装费用。',
    );
  if (power.some((p) => p.selection?.powerType === 'left'))
    add('info', '单边功率以左侧读数估算总功率；左右发力比例变化不包含在传感器自身的标称精度内。');
  if (power.some((p) => p.selection?.powerType === 'left' && !p.selection?.cleat))
    add('check', '左曲柄功率计还需检查曲柄长度、安装接口与左后下叉净空。');
  const pedals = chosen.filter(
    (p) => p.category === 'pedals' || (p.selection?.cleat && p.category === 'powermeters'),
  );
  if (pedals.length > 1)
    add('conflict', '清单同时包含普通锁踏与功率脚踏或多套脚踏；同一辆车只能安装一对。');
  const system =
    pedals[0]?.selection?.cleat ?? (state.ownedCleat === 'unknown' ? undefined : state.ownedCleat);
  const cleats = chosen.filter((p) => p.category === 'cleats');
  const shoes = chosen.find((p) => p.category === 'shoes');
  const bolts =
    shoes?.selection?.shoeBolts ??
    (state.ownedShoe === 'unknown' ? undefined : Number(state.ownedShoe));
  if (system && cleats.some((p) => p.selection?.cleat !== system))
    add('conflict', `锁片与 ${system} 锁踏制式不匹配。三孔安装方式相同并不代表可以混用。`);
  const expected = system === 'SPD' ? 2 : system === 'Speedplay' ? 4 : system ? 3 : undefined;
  if (bolts && expected && bolts !== expected)
    add('conflict', '鞋底孔位与锁踏制式不直接匹配；仅采用厂商明确允许的适配方案。');
  if (bolts && cleats.some((p) => p.selection?.shoeBolts !== bolts))
    add('conflict', '所选锁片与鞋底孔位不匹配。');
  if (pedals.some((p) => p.selection?.includesCleats) && cleats.length)
    add('info', '所选锁踏标准包装包含锁片；如浮动角度合适，另购锁片可从本次预算移除。');
  if (
    pedals.some((p) => p.selection?.includesCleats === false) &&
    !cleats.length &&
    state.ownedCleat === 'unknown'
  )
    add('check', '所选脚踏包装未列锁片；需确认已有合适锁片或另加一对。');
  if ((pedals.length || cleats.length) && !bolts)
    add('check', '还不知道锁鞋孔位，请在“已有设备”中选择或添加一双锁鞋。');
  if (cleats.length && !system) add('check', '锁片已加入，但现有锁踏制式未知；请先确认锁踏型号。');
  if (chosen.some((p) => p.category === 'wheels')) {
    add(
      'check',
      `轮组尚需核对：塔基 ${state.freehub === 'unknown' ? '未知' : state.freehub}、碟片座 ${state.rotor === 'unknown' ? '未知' : state.rotor}、轴端 ${state.axle === 'unknown' ? '未知' : state.axle}。这些是现车信息，不代表候选轮组已通过安装检查。`,
    );
    add(
      'check',
      '轮圈胎圈结构、允许胎宽、系统限重、碟片位置与卡钳间隙需要逐项确认；新轮组可能需要碟片垫片、胎垫、气嘴或重新装胎。',
    );
    if (state.route === 'wind')
      add('info', '经常遇到侧风时，先比较前轮操控和实测侧向力；框高相近也不能据此推断稳定性相同。');
  }
  return out;
}
export function candidateNote(p: Product, state: AdvisorState): string {
  const s = p.selection;
  if (p.category === 'wheels') {
    if (!s?.depthMm) return '结合规格表比较轮高与胎宽，选购时一并核对接口、备件与安装费用。';
    if (state.route === 'wind')
      return s.depthMm > 50
        ? '较高框轮候选：开阔路段请优先确认侧风操控。'
        : '可先列入中框候选；仍需侧风测试与实骑判断。';
    if (state.priority === 'weight' || state.route === 'climb')
      return `${s.weightG ? `标称 ${s.weightG} g` : '比较前可先称量轮组'}；在与旧轮组附件范围相同时比较减重。`;
    return state.priority === 'speed'
      ? '巡航比较需结合轮胎实际宽度和同条件风洞数据，不能只看轮高。'
      : '先比较整对到手价、花鼓维护、辐条备件与售后条件。';
  }
  if (p.category === 'computers')
    return s?.navigation === 'none'
      ? '适合基础数据记录；若需要地图导航，请改选地图机型。'
      : s?.navigation === 'track'
        ? '适合沿预先导入的轨迹骑行；核对偏航功能是否依赖手机。'
        : '适合陌生路线与地图需求；确认国内地图、离线重规划和固件。';
  if (p.category === 'powermeters')
    return s?.powerType === 'dual-pedal'
      ? '可跨车使用、独立测量左右输出；先匹配锁片与鞋。'
      : s?.powerType === 'left'
        ? '无需更换整套牙盘，总功率由左侧读数估算；仍需核对曲柄或锁片制式与安装空间。'
        : '测量盘爪总功率；先确认曲柄接口，再计算完整改装成本。';
  return p.tradeoff;
}
const enums: Record<string, readonly string[]> = {
  route: Object.keys(routes),
  priority: Object.keys(priorities),
  freehub: ['unknown', 'HG 公路 11/12 速', 'XDR', '其他'],
  rotor: ['unknown', 'Center Lock', '六钉', '圈刹'],
  axle: ['unknown', '12×100 / 12×142', '快拆', '其他'],
  ownedCleat: ['unknown', 'SPD-SL', 'KEO', 'SPD', 'Speedplay'],
  ownedShoe: ['unknown', '2', '3', '4'],
};
export function parseAdvisor(raw: string, products: Product[]): AdvisorState | null {
  if (raw.length > 20000) return null;
  try {
    const x: unknown = JSON.parse(raw);
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const value = x as Record<string, unknown>;
    if (value.version !== 1 || !Array.isArray(value.picks) || value.picks.length > 30) return null;
    const state = initialAdvisor();
    for (const key of Object.keys(state) as (keyof AdvisorState)[]) {
      if (key === 'version' || key === 'picks' || value[key] === undefined) continue;
      if (typeof value[key] !== typeof state[key]) return null;
      if (
        typeof value[key] === 'string' &&
        ((value[key] as string).length > 200 ||
          (enums[key] && !enums[key].includes(value[key] as string)))
      )
        return null;
      Object.assign(state, { [key]: value[key] });
    }
    const seen = new Set<string>();
    state.picks = value.picks.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('invalid item');
      const q = item as Quote;
      if (
        !products.some((p) => p.id === q.id) ||
        seen.has(q.id) ||
        typeof q.price !== 'string' ||
        q.price.length > 30 ||
        typeof q.version !== 'string' ||
        q.version.length > 200 ||
        !Number.isInteger(q.quantity) ||
        q.quantity < 1 ||
        q.quantity > 4
      )
        throw new Error('invalid quote');
      seen.add(q.id);
      return { id: q.id, price: q.price, quantity: q.quantity, version: q.version };
    });
    return state;
  } catch {
    return null;
  }
}
