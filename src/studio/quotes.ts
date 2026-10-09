import { customItem, money, newPlan, parsePlan, type Plan, type PlanItem } from './model';
import { conditionLabels, salesGaps, salesText, type Condition } from './sales';

export const quoteStorageKey = 'velodex.studio.quotes.v1';
export type QuoteLine = {
  key: string;
  quantity: number;
  price: string;
  match: 'unreviewed' | 'same' | 'alternative';
  offered: string;
  condition: Condition;
  stock: 'unspecified' | 'in-stock' | 'order' | 'unavailable';
  leadTime: string;
  included: string;
  excluded: string;
  warranty: string;
};
export type MerchantQuote = {
  id: string;
  revisionOf: string;
  merchant: string;
  channel: string;
  date: string;
  validUntil: string;
  updatedAt: string;
  bikeName: string;
  size: string;
  request: PlanItem[];
  lines: QuoteLine[];
  labor: string;
  shipping: string;
  consumables: string;
  discount: string;
  tax: 'unspecified' | 'included' | 'extra';
  taxAmount: string;
  service: string;
  notes: string;
};
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function cents(s: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim())) return null;
  const n = Number(s);
  return n <= 1000000 ? Math.round(n * 100) : null;
}
// A quote contains the requested purchase scope, never the rider's budget,
// resale assumptions, training records, fitting inputs or private plan notes.
export function requestItems(plan: Plan) {
  return plan.items
    .filter((i) => i.action === 'buy')
    .map((i) => ({
      ...customItem(i.category),
      key: i.key,
      productId: i.productId,
      name: i.name,
      variant: i.variant,
      quantity: i.quantity,
      ...(i.sales ? { sales: structuredClone(i.sales) } : {}),
    }));
}
function signature(items: PlanItem[], bikeName: string, size: string) {
  return JSON.stringify([
    bikeName,
    size,
    [...items]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((i) => [
        i.key,
        i.productId,
        i.category,
        i.name,
        i.variant,
        i.quantity,
        i.sales
          ? [
              i.sales.profileId,
              i.sales.market,
              i.sales.condition,
              Object.entries(i.sales.attributes).sort(([a], [b]) => a.localeCompare(b)),
              i.sales.scope,
              i.sales.included,
              i.sales.excluded,
            ]
          : null,
      ]),
  ]);
}
export function matchesRequest(q: MerchantQuote, plan: Plan) {
  return (
    signature(q.request, q.bikeName, q.size) ===
    signature(requestItems(plan), plan.bikeName, plan.size)
  );
}
export function createQuote(plan: Plan, today = localDate()): MerchantQuote {
  const request = requestItems(plan);
  return {
    id: crypto.randomUUID(),
    revisionOf: '',
    merchant: '',
    channel: '',
    date: today,
    validUntil: '',
    updatedAt: new Date().toISOString(),
    bikeName: plan.bikeName,
    size: plan.size,
    request,
    lines: request.map((i) => ({
      key: i.key,
      quantity: i.quantity,
      price: '',
      match: 'unreviewed',
      offered: '',
      condition: i.sales?.condition || (i.variant.includes('二手购入') ? 'used' : 'new'),
      stock: 'unspecified',
      leadTime: '',
      included: i.sales?.included || '',
      excluded: i.sales?.excluded || '',
      warranty: '',
    })),
    labor: '',
    shipping: '',
    consumables: '',
    discount: '',
    tax: 'unspecified',
    taxAmount: '',
    service: '',
    notes: '',
  };
}
export function reviseQuote(q: MerchantQuote): MerchantQuote {
  return {
    ...structuredClone(q),
    id: crypto.randomUUID(),
    revisionOf: q.id,
    updatedAt: new Date().toISOString(),
  };
}
export function updateQuoteLine(line: QuoteLine, patch: Partial<QuoteLine>): QuoteLine {
  const scopeChanged = (['quantity', 'condition', 'offered', 'included', 'excluded'] as const).some(
    (key) => key in patch && patch[key] !== line[key],
  );
  return { ...line, ...patch, ...(scopeChanged ? { match: 'unreviewed' as const } : {}) };
}
export function assessQuote(q: MerchantQuote, plan: Plan, today = localDate()) {
  const issues: string[] = [];
  let known = 0;
  let complete = true;
  if (!q.merchant.trim()) issues.push('填写商家名称');
  if (!validDate(q.date) || q.date > today) issues.push('报价日期无效或晚于今天');
  if (!validDate(q.validUntil) || q.validUntil < q.date) issues.push('填写有效的报价截止日期');
  else if (q.validUntil < today) issues.push('报价已过期');
  if (!matchesRequest(q, plan)) issues.push('报价对应另一份清单或较早的规格');
  if (!q.request.length) {
    complete = false;
    issues.push('没有采购项目');
  }
  for (const item of q.request) {
    const l = q.lines.find((l) => l.key === item.key);
    if (!l) {
      complete = false;
      issues.push(`${item.name}缺少报价行`);
      continue;
    }
    const price = cents(l.price);
    if (price === null) {
      complete = false;
      issues.push(`${item.name}缺少有效单价`);
    } else known += price * l.quantity;
    if (l.quantity !== item.quantity) issues.push(`${item.name}数量不同`);
    const gaps = salesGaps(item);
    if (gaps.length) issues.push(`${item.name}：清单需补充${gaps.join('、')}`);
    if (l.match !== 'same')
      issues.push(
        `${item.name}：${l.match === 'alternative' ? '提供了替代规格' : '尚未核对版本与附件范围'}`,
      );
    if (
      l.condition !==
      (item.sales?.condition || (item.variant.includes('二手购入') ? 'used' : 'new'))
    )
      issues.push(`${item.name}成色不同`);
    if (l.stock === 'unspecified') issues.push(`${item.name}未提供供货状态`);
    if (l.stock === 'unavailable') issues.push(`${item.name}无法供货`);
    if (l.stock === 'order' && !l.leadTime.trim()) issues.push(`${item.name}需补充订货交期`);
    if (!l.warranty.trim()) issues.push(`${item.name}需填写保修说明，可明确无保修`);
  }
  for (const [key, title] of [
    ['labor', '工时'],
    ['shipping', '运费'],
    ['consumables', '安装件与耗材'],
    ['discount', '整单优惠'],
  ] as const) {
    const n = cents(q[key]);
    if (n === null) {
      complete = false;
      issues.push(`${title}未计价；不收费请填 0`);
    } else known += key === 'discount' ? -n : n;
  }
  if (q.tax === 'unspecified') {
    complete = false;
    issues.push('需说明是否含税');
  }
  if (q.tax === 'extra') {
    const tax = cents(q.taxAmount);
    if (tax === null) {
      complete = false;
      issues.push('需填写另付税费');
    } else known += tax;
  }
  if (known < 0) {
    complete = false;
    issues.push('优惠不能超过已计价费用');
  }
  return {
    known: known / 100,
    total: complete ? known / 100 : null,
    comparable: complete && issues.length === 0,
    issues,
  };
}
export function parseQuote(raw: unknown): MerchantQuote | null {
  try {
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw) ||
      JSON.stringify(raw).length > 250000
    )
      return null;
    const q = raw as MerchantQuote;
    const str = (v: unknown, max = 600) => typeof v === 'string' && v.length <= max;
    const amount = (v: unknown) => str(v, 24) && (v === '' || cents(v as string) !== null);
    if (
      !str(q.id, 100) ||
      !q.id ||
      !str(q.revisionOf, 100) ||
      !str(q.merchant, 200) ||
      !str(q.channel, 600) ||
      !str(q.date, 10) ||
      !str(q.validUntil, 10) ||
      !str(q.updatedAt, 40) ||
      !str(q.bikeName, 200) ||
      !str(q.size, 200) ||
      !str(q.service, 2000) ||
      !str(q.notes, 3000)
    )
      return null;
    if (
      !['included', 'extra', 'unspecified'].includes(q.tax) ||
      !['labor', 'shipping', 'consumables', 'discount', 'taxAmount'].every((k) =>
        amount(q[k as keyof MerchantQuote]),
      )
    )
      return null;
    const plan = parsePlan({ ...newPlan(), items: q.request });
    if (
      !plan ||
      plan.items.some((i) => i.action !== 'buy') ||
      !Array.isArray(q.lines) ||
      q.lines.length !== plan.items.length
    )
      return null;
    const lines: QuoteLine[] = [];
    for (const l of q.lines) {
      if (
        !l ||
        !plan.items.some((i) => i.key === l.key) ||
        !Number.isInteger(l.quantity) ||
        l.quantity < 1 ||
        l.quantity > 20 ||
        !amount(l.price) ||
        !['same', 'unreviewed', 'alternative'].includes(l.match) ||
        !['new', 'takeoff', 'used'].includes(l.condition) ||
        !['unspecified', 'in-stock', 'order', 'unavailable'].includes(l.stock) ||
        !['offered', 'included', 'excluded', 'leadTime', 'warranty'].every((k) =>
          str(l[k as keyof QuoteLine]),
        )
      )
        return null;
      lines.push({
        key: l.key,
        quantity: l.quantity,
        price: l.price,
        match: l.match,
        offered: l.offered,
        condition: l.condition,
        stock: l.stock,
        leadTime: l.leadTime,
        included: l.included,
        excluded: l.excluded,
        warranty: l.warranty,
      });
    }
    if (new Set(lines.map((l) => l.key)).size !== lines.length) return null;
    return {
      id: q.id,
      revisionOf: q.revisionOf,
      merchant: q.merchant,
      channel: q.channel,
      date: q.date,
      validUntil: q.validUntil,
      updatedAt: q.updatedAt,
      bikeName: q.bikeName,
      size: q.size,
      request: requestItems(plan),
      lines,
      labor: q.labor,
      shipping: q.shipping,
      consumables: q.consumables,
      discount: q.discount,
      tax: q.tax,
      taxAmount: q.taxAmount,
      service: q.service,
      notes: q.notes,
    };
  } catch {
    return null;
  }
}
export function quoteDocument(q: MerchantQuote) {
  return JSON.stringify({ format: 'velodex-quote', version: 1, quote: q }, null, 2);
}
export function readQuoteDocument(text: string) {
  if (new TextEncoder().encode(text).length > 512000) throw new Error('报价文件超过 500 KB');
  const doc = JSON.parse(text);
  if (doc?.format !== 'velodex-quote' || doc.version !== 1)
    throw new Error('请选择循风导出的报价 JSON 文件');
  const quote = parseQuote(doc.quote);
  if (!quote) throw new Error('报价格式或金额无效，原有报价未改变');
  return quote;
}
export function quoteReport(q: MerchantQuote, plan: Plan, today = localDate()) {
  const a = assessQuote(q, plan, today);
  return [
    `${q.merchant || '未命名商家'} · 报价记录`,
    `报价日期：${q.date || '未填写'}；有效期至：${q.validUntil || '未填写'}`,
    `来源 / 渠道：${q.channel || '未填写'}`,
    `车辆：${q.bikeName || '自由装车'} ${q.size}`,
    ...q.request.map((i) => {
      const l = q.lines.find((l) => l.key === i.key)!;
      return `${i.name}\n要求：${i.sales ? salesText(i.sales) : i.variant}\n提供：${l.offered || i.variant}；${conditionLabels[l.condition]}；${l.quantity} 个销售单位 × ${l.price || '未报价'} 元\n包含：${l.included || '未列明'}；不含：${l.excluded || '未列明'}\n供货：${stockLabels[l.stock]} ${l.leadTime}；保修：${l.warranty || '未列明'}`;
    }),
    `工时 ${q.labor || '未报价'}；运费 ${q.shipping || '未报价'}；耗材 ${q.consumables || '未报价'}；优惠 ${q.discount || '未报价'}`,
    `税费：${q.tax === 'included' ? '已包含' : q.tax === 'extra' ? q.taxAmount || '未报价' : '未说明'}`,
    `${a.total === null ? '已知费用' : '含税交付价'}：${money(a.total ?? a.known)}（不扣旧件转售）`,
    a.comparable ? '已按当前清单核对同规格范围' : `比价提示：${a.issues.join('；')}`,
    `服务：${q.service}`,
    `备注：${q.notes}`,
    '此记录由使用者录入，不代表平台已验证商家或承诺库存。',
  ].join('\n\n');
}
export const stockLabels = {
  unspecified: '未提供',
  'in-stock': '现货',
  order: '订货',
  unavailable: '无法供货',
};
