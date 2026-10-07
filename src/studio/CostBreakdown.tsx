import { amount, estimate, money, type Plan } from './model';

export default function CostBreakdown({ plan }: { plan: Plan }) {
  const total = estimate(plan),
    budget = amount(plan.budget);
  const hasBudget = budget !== null && budget > 0;
  const over = hasBudget && total.net > budget;
  const missing = total.missingPrices.length > 0 || total.missingFees.length > 0;
  return (
    <div className="st-cost-breakdown">
      {hasBudget ? (
        <div className={`st-budget-progress${over ? ' is-over' : ''}`}>
          <div>
            <span>净预算 {money(budget)}</span>
            <b>{over ? '已超预算' : total.priceComplete ? '预算结余' : '已知支出后余额'}</b>
          </div>
          <strong>{money(Math.abs(budget - total.net))}</strong>
          <div
            className="st-budget-track"
            role="meter"
            aria-label="已知净支出占预算比例"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, (total.net / budget) * 100))}
            aria-valuetext={`${((total.net / budget) * 100).toFixed(0)}%，${total.priceComplete ? '费用已填写' : '尚有未报价项目'}`}
          >
            <i style={{ width: `${Math.min(100, Math.max(0, (total.net / budget) * 100))}%` }} />
          </div>
          {missing && <small>尚有费用未填，当前余额不能视为最终结余</small>}
          {!missing && !plan.items.some((i) => i.action === 'buy') && (
            <small>还没有加入采购项，余额将随选配更新</small>
          )}
        </div>
      ) : (
        <p className="st-fine">设置净预算后，可查看支出占比与剩余额度。</p>
      )}
      <dl className="st-cost-ledger">
        <div>
          <dt>新件采购</dt>
          <dd>{money(total.subtotal)}</dd>
        </div>
        <div>
          <dt>工时与运费</dt>
          <dd>{amount(plan.labor) === null ? '未填写' : money(Number(plan.labor))}</dd>
        </div>
        <div>
          <dt>安装件与耗材</dt>
          <dd>{amount(plan.consumables) === null ? '未填写' : money(Number(plan.consumables))}</dd>
        </div>
        {plan.mode === 'upgrade' && (
          <div>
            <dt>旧件转售抵扣</dt>
            <dd>{amount(plan.resale) === null ? '未填写' : `−${money(Number(plan.resale))}`}</dd>
          </div>
        )}
      </dl>
      <p className="st-fine">沿用件不重复计价；机动预留只用于候选筛选，不计入支出。</p>
    </div>
  );
}
