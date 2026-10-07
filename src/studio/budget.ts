import type { PartsCatalog, Product, ReferencePrice } from '../types';
import { frames, matchesPrice } from './library';
import {
  amount,
  checks,
  customItem,
  estimate,
  productItem,
  unitPrice,
  type Category,
  type Plan,
  type PlanItem,
} from './model';

export type Quote = { amount: number; date: string };
export type Quotes = Record<string, Quote>;
export type BudgetCandidate = {
  id: string;
  name: string;
  brand?: string;
  category: Category;
  reference?: ReferencePrice;
  source: string;
  image?: string;
  product?: Product;
  item: PlanItem;
};
export type BudgetNeeds = {
  category: Category;
  replace: string;
  reserve: string;
  sort: 'price' | 'weight';
  depth: 'any' | 'low' | 'medium' | 'deep';
  map: boolean;
  power: 'any' | 'spider' | 'dual-pedal';
};
export function parseQuotes(value: unknown): Quotes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 300)
      .filter(
        ([id, q]) =>
          /^[\w-]{1,100}$/.test(id) &&
          q &&
          typeof q === 'object' &&
          Number.isFinite(q.amount) &&
          q.amount > 0 &&
          q.amount <= 1000000 &&
          typeof q.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(q.date),
      )
      .map(([id, q]) => [id, { amount: q.amount, date: q.date }]),
  );
}
export function budgetCatalog(parts: PartsCatalog, category: Category): BudgetCandidate[] {
  if (category === 'frame')
    return frames.map((f) => ({
      id: f.id,
      name: f.name,
      category,
      reference: f.price,
      source: f.source,
      image: f.image,
      item: {
        ...customItem('frame'),
        name: f.name,
        variant: f.market,
        source: f.source,
        reference: f.price,
      },
    }));
  return parts.products
    .filter((p) => p.category === category && p.status === 'current')
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: parts.brands.find((b) => b.id === p.brandId)?.name || p.brandId,
      category,
      reference: p.price,
      source: p.source,
      image: p.image,
      product: p,
      item: productItem(p),
    }));
}
export function candidatePlan(
  plan: Plan,
  candidate: BudgetCandidate,
  quotes: Quotes,
  replace: string,
): Plan {
  const old = plan.items.find(
    (i) => i.key === replace && i.action === 'buy' && i.category === candidate.category,
  );
  if (replace && !old) throw new Error('被替换的采购项已经改变，请重新选择。');
  const item: PlanItem = {
    ...candidate.item,
    key: old?.key || candidate.item.key,
    quantity: old?.quantity || candidate.item.quantity,
    price: quotes[candidate.id] ? String(quotes[candidate.id].amount) : '',
  };
  return {
    ...plan,
    items: old ? plan.items.map((i) => (i.key === old.key ? item : i)) : [...plan.items, item],
  };
}
export function budgetOptions(plan: Plan, parts: PartsCatalog, needs: BudgetNeeds, quotes: Quotes) {
  const catalog = budgetCatalog(parts, needs.category);
  const old = plan.items.find(
    (i) => i.key === needs.replace && i.action === 'buy' && i.category === needs.category,
  );
  const baseline = estimate({ ...plan, items: plan.items.filter((i) => i.key !== old?.key) });
  const budget = amount(plan.budget),
    reserve = amount(needs.reserve);
  const missing = [
    ...baseline.missingPrices.map((i) => i.name || '未命名零件'),
    ...baseline.missingFees,
  ];
  if (needs.replace && !old) missing.push('重新选择被替换的采购项');
  const valid = budget !== null && budget > 0 && reserve !== null && !missing.length;
  const allowance = valid ? budget! - baseline.net - reserve! : null;
  let noPrice = 0,
    mismatch = 0,
    overBudget = 0,
    unknownSpec = 0;
  const options = catalog.flatMap((c) => {
    if (needs.replace && !old) return [];
    if (
      c.item.productId &&
      old?.productId === c.item.productId &&
      (!quotes[c.id] || quotes[c.id].amount === unitPrice(old))
    )
      return [];
    if (!quotes[c.id] && !matchesPrice(c.reference, 'cn')) {
      noPrice++;
      return [];
    }
    const s = c.product?.selection;
    if (needs.category === 'wheels' && needs.depth !== 'any') {
      if (s?.depthMm == null) {
        unknownSpec++;
        return [];
      }
      if (
        (needs.depth === 'low' && s.depthMm > 45) ||
        (needs.depth === 'medium' && (s.depthMm < 40 || s.depthMm > 55)) ||
        (needs.depth === 'deep' && s.depthMm < 55)
      )
        return [];
    }
    if (needs.category === 'computers' && needs.map && s?.navigation !== 'map') return [];
    if (needs.category === 'powermeters' && needs.power !== 'any' && s?.powerType !== needs.power)
      return [];
    if (needs.sort === 'weight' && !c.item.weight) {
      unknownSpec++;
      return [];
    }
    const next = candidatePlan(plan, c, quotes, needs.replace);
    const warnings = checks(next, parts);
    const conflicts = warnings.filter((n) => n.level === 'conflict');
    // Existing conflicts matter too: never label a proposal installable while the plan is invalid.
    if (conflicts.length) {
      mismatch++;
      return [];
    }
    const total = estimate(next),
      cost =
        unitPrice(next.items.find((i) => i.key === (old?.key || c.item.key))!)! *
        (old?.quantity || c.item.quantity);
    if (allowance !== null && cost > allowance + 0.005) {
      overBudget++;
      return [];
    }
    return [
      {
        candidate: c,
        next,
        cost,
        total,
        checks: warnings.filter((n) => n.level === 'check'),
        saving: old && unitPrice(old) !== null ? unitPrice(old)! * old.quantity - cost : null,
      },
    ];
  });
  options.sort((a, b) =>
    needs.sort === 'weight'
      ? Number(a.candidate.item.weight) - Number(b.candidate.item.weight) || a.cost - b.cost
      : a.cost - b.cost,
  );
  return {
    valid,
    missing,
    allowance,
    options,
    catalog,
    noPrice,
    mismatch,
    overBudget,
    unknownSpec,
    fixed: baseline.net,
    reserve,
    budget,
    existing: old,
  };
}
