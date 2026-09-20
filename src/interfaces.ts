export const sources = {
  shimano: {
    name: 'Shimano C-731 塔基与飞轮兼容表',
    url: 'https://productinfo.shimano.com/en/compatibility/C-731',
  },
  sram: {
    name: 'SRAM XD / XDR 说明',
    url: 'https://support.sram.com/hc/en-us/articles/6129174825371-Do-I-need-an-XD-or-XDR-driver-to-use-an-XD-compatible-cassette',
  },
  bb: {
    name: 'SRAM DUB Road 中轴与垫圈表',
    url: 'https://www.sram.com/globalassets/document-hierarchy/compatibility-map/road/dub-choose-a-road-bottom-bracket-compatibility-map.pdf',
  },
  shimanoBB: {
    name: 'Shimano BB-R9100 产品资料',
    url: 'https://bike.shimano.com/en-NA/products/components/pdp.P-BB-R9100.html',
  },
  t47: {
    name: 'Wheels Mfg T47 规格与轴承位置',
    url: 'https://wheelsmfg.com/blogs/bottom-brackets',
  },
  axle: {
    name: 'DT Swiss 轴制式与端盖转换说明',
    url: 'https://www.dtswiss.com/en/components/hubs-and-rws/hubs-road/240',
  },
  rotor: {
    name: 'Shimano CENTER LOCK 接口说明',
    url: 'https://bike.shimano.com/en-AU/technologies/details/center-lock.html',
  },
  adapter: {
    name: 'Shimano 六钉转 CENTER LOCK 适配器手册',
    url: 'https://si.shimano.com/en/pdfs/dm/MDBR001/DM-MDBR001-06-ENG.pdf',
  },
};
const shells = [
  ['bsa68', 'BSA 螺纹 · 68 mm'],
  ['ita70', '意式螺纹 · 70 mm'],
  ['pf86', 'PF86.5 / BB86 · 41 × 86.5 mm'],
  ['t4768', 'T47 · 68 mm'],
  ['t47855', 'T47 · 85.5 mm'],
  ['t47865', 'T47 · 86.5 mm'],
];
const crank = [
  ['shimano', 'Shimano 公路 HOLLOWTECH II'],
  ['dub-road', 'SRAM DUB Road 标准轴'],
  ['dub-wide', 'SRAM DUB Road Wide'],
  ['gxp', 'SRAM GXP'],
];
const front = [
  ['ta12-100', '12 × 100 mm 桶轴'],
  ['ta15-100', '15 × 100 mm 桶轴'],
  ['qr100', '100 mm 快拆'],
];
const rear = [
  ['ta12-142', '12 × 142 mm 桶轴'],
  ['ta12-148', '12 × 148 mm Boost'],
  ['qr130', '130 mm 快拆'],
  ['qr135', '135 mm 快拆'],
];
const rotors = [
  ['cl', 'CENTER LOCK'],
  ['six', '六钉'],
];
export const interfaceFields = {
  frameBB: { label: '车架五通标准', options: shells },
  bbShell: { label: '中轴注明适配的五通标准', options: shells },
  crank: { label: '所选曲柄系统', options: crank },
  bbCrank: { label: '中轴注明支持的曲柄版本', options: crank },
  forkAxle: { label: '前叉要求的轴制式', options: front },
  frontHub: { label: '前花鼓当前端盖规格', options: front },
  frameAxle: { label: '车架后轴制式', options: rear },
  rearHub: { label: '后花鼓当前端盖规格', options: rear },
  freehub: {
    label: '当前塔基',
    options: [
      ['hg-l', 'HG spline L · 公路 11/12 速'],
      ['hg-l2', 'HG spline L2 · 公路 12 速专用'],
      ['xdr', 'SRAM XDR'],
      ['xd', 'SRAM XD'],
      ['micro', 'Shimano MICRO SPLINE'],
    ],
  },
  cassette: {
    label: '飞轮的具体接口类别',
    options: [
      ['road11', 'Shimano 公路 11 速 · 常规型号'],
      ['hg700', 'Shimano CS-HG700 / CS-HG800 / CS-RS400'],
      ['road12', 'Shimano HG 公路 12 速'],
      ['xdr-road', 'SRAM XDR 公路飞轮'],
      ['xd-mtb', 'SRAM XD 山地飞轮'],
      ['micro12', 'Shimano MICRO SPLINE 山地 12 速'],
    ],
  },
  hubRotor: { label: '花鼓碟片安装接口', options: rotors },
  rotor: { label: '所选碟片接口', options: rotors },
} as const;
export type InterfaceKey = keyof typeof interfaceFields;
export type InterfaceState = Record<InterfaceKey, string>;
export const interfaceKeys = Object.keys(interfaceFields) as InterfaceKey[];
export function emptyInterfaces(): InterfaceState {
  return Object.fromEntries(interfaceKeys.map((k) => [k, ''])) as InterfaceState;
}
export function parseInterfaces(value: unknown): InterfaceState {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('接口记录格式无效');
  const v = value as Record<string, unknown>,
    result = emptyInterfaces();
  for (const k of interfaceKeys) {
    const text = v[k];
    if (
      typeof text !== 'string' ||
      (text !== '' && !interfaceFields[k].options.some((o) => o[0] === text))
    )
      throw new Error('接口记录包含不认识的选项');
    result[k] = text;
  }
  return result;
}
export type InterfaceResult = {
  id: string;
  title: string;
  status: 'unknown' | 'match' | 'review' | 'blocked';
  text: string;
  next: string;
  source: (keyof typeof sources)[];
};
export const statusLabels = {
  unknown: '资料未齐',
  match: '该接口条件一致',
  review: '有附加条件',
  blocked: '当前配置不能直接装',
};
export function checkInterfaces(raw: InterfaceState): InterfaceResult[] {
  const s = parseInterfaces(raw),
    results: InterfaceResult[] = [];
  const pair = (
    id: string,
    title: string,
    a: InterfaceKey,
    b: InterfaceKey,
    matchText: string,
    next: string,
    source: InterfaceResult['source'],
  ) => {
    const known = !!s[a] && !!s[b],
      matches = s[a] === s[b];
    results.push({
      id,
      title,
      status: !known ? 'unknown' : matches ? 'match' : 'blocked',
      text: !known
        ? '两侧规格尚未填齐。'
        : matches
          ? matchText
          : '两侧所选接口不同，当前零件不能直接配合；有无转换方案需查所选产品。',
      next,
      source,
    });
  };
  pair(
    'shell',
    '车架 × 中轴',
    'frameBB',
    'bbShell',
    '螺纹 / 压入标准及壳体宽度的声明一致。',
    '确认中轴具体料号、内外置轴承版本与厂商安装说明；不要把所有 T47 视作同一种。',
    ['bb', 'shimanoBB', 't47'],
  );
  pair(
    'crank',
    '中轴 × 曲柄',
    'crank',
    'bbCrank',
    '中轴声明的曲柄版本与选择一致。',
    '仍须查曲柄轴长、链线、预压与垫圈配置；DUB Road 与 Wide 的垫圈不能互抄。',
    ['bb', 'shimanoBB'],
  );
  const crankResult = results[1];
  if (s.crank.startsWith('dub-') && s.bbCrank.startsWith('dub-') && s.crank !== s.bbCrank)
    Object.assign(crankResult, {
      status: 'review',
      text: 'DUB Road 与 Wide 可共用部分中轴结构，但需要对应版本与垫圈；当前不能直接套用配置。',
    });
  pair(
    'front',
    '前叉 × 前花鼓',
    'forkAxle',
    'frontHub',
    '直径、开档与轴制式相符。',
    '花鼓开档不等于贯通轴总长；贯通轴长度、螺距和头部应按前叉原厂要求核对。',
    ['axle'],
  );
  pair(
    'rear',
    '车架 × 后花鼓',
    'frameAxle',
    'rearHub',
    '直径、开档与轴制式相符。',
    '以花鼓具体型号查端盖转换表；不要推定更换端盖就能改变任意开档。',
    ['axle'],
  );
  let status: InterfaceResult['status'] = 'unknown',
    text = '请选择塔基及飞轮的具体类别。';
  if (s.freehub && s.cassette) {
    status = 'blocked';
    text = '此塔基与所选飞轮接口不属于可直接安装的组合；需更换匹配零件。';
    const matching: Record<string, string[]> = {
      'hg-l': ['road11', 'road12'],
      'hg-l2': ['road12'],
      xdr: ['xdr-road'],
      xd: ['xd-mtb'],
      micro: ['micro12'],
    };
    if (matching[s.freehub]?.includes(s.cassette)) {
      status = 'match';
      text = '这组飞轮 / 塔基属于原厂列明的接口组合。';
    }
    if (s.freehub === 'hg-l' && s.cassette === 'hg700') {
      status = 'review';
      text = 'CS-HG700 / HG800 / RS400 装在 HG spline L 上需要 1.85 mm 垫圈。';
    }
    if (s.freehub === 'xdr' && s.cassette === 'xd-mtb') {
      status = 'review';
      text = 'XD 飞轮装在 XDR 塔基上需要 1.85 mm 垫圈。反向将 XDR 飞轮装到 XD 上不成立。';
    }
    if (s.freehub === 'hg-l2' && ['road11', 'hg700'].includes(s.cassette))
      text = 'HG spline L2 是 Shimano 公路 12 速专用，不能直接安装所选 11 速飞轮。';
  }
  results.push({
    id: 'cassette',
    title: '塔基 × 飞轮',
    status,
    text,
    next: '这里只核对安装接口，速别相同也不代表后拨、链条和手变能混用。须再查齿比范围、后拨容量与系统兼容表。',
    source: ['shimano', 'sram'],
  });
  pair(
    'rotor',
    '花鼓 × 碟片',
    'hubRotor',
    'rotor',
    '碟片固定接口一致。',
    '还需核对直径、厚度、锁环与轴端间隙，以及夹器 / 来令片和车架前叉允许的规格。',
    ['rotor'],
  );
  if (s.hubRotor === 'cl' && s.rotor === 'six')
    Object.assign(results.at(-1)!, {
      status: 'review',
      text: '六钉碟片可在适用的 CENTER LOCK 花鼓上借助指定适配器安装；必须核对适配器型号、碟片与轴的限制。',
      source: ['adapter'],
    });
  return results;
}
export function interfaceReport(state: InterfaceState) {
  return [
    'VÉLODEX 装车接口核对记录 · 规则核对 2026-09-20',
    ...interfaceKeys.map(
      (k) =>
        `${interfaceFields[k].label}：${interfaceFields[k].options.find((o) => o[0] === state[k])?.[1] || '未确定'}`,
    ),
    '',
    ...checkInterfaces(state).flatMap((r) => [
      `${r.title} / ${statusLabels[r.status]}`,
      r.text,
      r.next,
      ...r.source.map((k) => `${sources[k].name}：${sources[k].url}`),
      '',
    ]),
    '仅核对上述接口条件，不是整车装配认证。未涵盖夹器安装座、油管、电子协议、把组、座管、轮胎间隙等项目。',
  ].join('\n');
}
