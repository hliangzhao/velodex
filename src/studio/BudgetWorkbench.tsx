import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, SlidersHorizontal, Search, GitCompareArrows } from 'lucide-react';
import type { PartsCatalog, Product } from '../types';
import { imageUrl } from '../catalog';
import PhotoButton from '../PhotoButton';
import { referencePriceLabel } from '../upgrade-planner';
import { categories, label, money, type Plan, type Category } from './model';
import { budgetOptions, parseQuotes, type BudgetNeeds, type Quotes } from './budget';

const quotesKey = 'velodex.studio.quotes.v1';
export default function BudgetWorkbench({
  plan,
  parts,
  change,
  detail,
}: {
  plan: Plan;
  parts: PartsCatalog;
  change: (p: Plan) => void;
  detail: (p: Product) => void;
}) {
  const [needs, setNeeds] = useState<BudgetNeeds>({
    category: 'wheels',
    replace: plan.items.find((i) => i.category === 'wheels' && i.action === 'buy')?.key || '',
    reserve: '300',
    sort: 'price',
    depth: 'any',
    map: false,
    power: 'any',
  });
  const [quotes, setQuotes] = useState<Quotes>(() => {
    try {
      return parseQuotes(JSON.parse(localStorage.getItem(quotesKey) || '{}'));
    } catch {
      return {};
    }
  });
  const [quoteId, setQuoteId] = useState(''),
    [quoteInput, setQuoteInput] = useState(''),
    [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''),
    [limit, setLimit] = useState(6);
  const [compared, setCompared] = useState<string[]>([]);
  const result = useMemo(
    () => budgetOptions(plan, parts, needs, quotes),
    [plan, parts, needs, quotes],
  );
  const purchases = plan.items.filter((i) => i.action === 'buy' && i.category === needs.category);
  const filtered = result.options.filter((o) =>
    `${o.candidate.brand || ''} ${o.candidate.name}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const selected = result.valid
    ? result.options.filter((o) => compared.includes(o.candidate.id))
    : [];
  useEffect(() => {
    setLimit(6);
  }, [query, needs, plan, quotes]);
  const photos = result.options
    .filter((o) => o.candidate.image)
    .map(({ candidate: c }) => ({
      id: c.id,
      name: c.name,
      image: c.image!,
      source: c.product?.imageSource || c.source,
      note: c.product?.imageCaption,
    }));
  const putQuote = () => {
    if (
      !quoteId ||
      !/^\d+(\.\d{1,2})?$/.test(quoteInput) ||
      +quoteInput <= 0 ||
      +quoteInput > 1000000
    ) {
      setNotice('请选择型号，填写大于零的人民币单价，最多两位小数。');
      return;
    }
    const date = new Date(),
      local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const next = { ...quotes, [quoteId]: { amount: +quoteInput, date: local } };
    try {
      localStorage.setItem(quotesKey, JSON.stringify(next));
      setQuotes(next);
      setNotice('报价已保存在本机，仅用于你的比较。');
    } catch {
      setNotice('本机保存失败，请检查存储空间。');
    }
  };
  return (
    <section className="st-panel st-budget-workbench" id="budget-workbench">
      <details>
        <summary>
          <SlidersHorizontal size={19} />
          <strong>按预算挑选配件</strong>
          <span>筛选 · 比较 · 加入方案</span>
        </summary>
        <p>
          先确定需要的规格，再比较整份清单的费用。根据已收录版本的价格、参数和安装条件，寻找预算内的选择。
        </p>
        <div className="st-budget-fields">
          <label>
            净预算 / 元
            <input
              type="number"
              min="1"
              max="1000000"
              value={plan.budget}
              placeholder="例如 10000"
              onChange={(e) => change({ ...plan, budget: e.target.value })}
            />
          </label>
          <label>
            另留机动金额 / 元
            <input
              type="number"
              min="0"
              value={needs.reserve}
              onChange={(e) => setNeeds({ ...needs, reserve: e.target.value })}
            />
            <small>默认 300 元为可修改的预留，不计入采购价</small>
          </label>
          <label>
            这次选什么
            <select
              value={needs.category}
              onChange={(e) => {
                setNeeds({
                  ...needs,
                  category: e.target.value as Category,
                  replace: '',
                  sort: 'price',
                });
                setQuoteId('');
                setQuoteInput('');
                setQuery('');
                setCompared([]);
              }}
            >
              {categories
                .filter(([id]) => id !== 'other')
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            加入还是替换
            <select
              value={needs.replace}
              onChange={(e) => setNeeds({ ...needs, replace: e.target.value })}
            >
              <option value="">新增一项采购</option>
              {purchases.map((i) => (
                <option key={i.key} value={i.key}>
                  替换 {i.name || label(i.category)}
                </option>
              ))}
            </select>
            <small>沿用件、拆下件和其他采购不会被改动</small>
          </label>
          <label>
            排序依据
            <select
              value={needs.sort}
              onChange={(e) => setNeeds({ ...needs, sort: e.target.value as BudgetNeeds['sort'] })}
            >
              <option value="price">总支出较低优先</option>
              <option value="weight">有标称重量的版本优先比较</option>
            </select>
          </label>
          {needs.category === 'wheels' && (
            <label>
              目标框高
              <select
                value={needs.depth}
                onChange={(e) =>
                  setNeeds({ ...needs, depth: e.target.value as BudgetNeeds['depth'] })
                }
              >
                <option value="any">不限框高</option>
                <option value="low">45 mm 及以下</option>
                <option value="medium">40–55 mm</option>
                <option value="deep">55 mm 及以上</option>
              </select>
            </label>
          )}
          {needs.category === 'powermeters' && (
            <label>
              测量结构
              <select
                value={needs.power}
                onChange={(e) =>
                  setNeeds({ ...needs, power: e.target.value as BudgetNeeds['power'] })
                }
              >
                <option value="any">不限结构，先核对曲柄和锁片</option>
                <option value="spider">盘爪式</option>
                <option value="dual-pedal">双边功率脚踏</option>
              </select>
            </label>
          )}
          {needs.category === 'computers' && (
            <label className="st-budget-check">
              <input
                type="checkbox"
                checked={needs.map}
                onChange={(e) => setNeeds({ ...needs, map: e.target.checked })}
              />
              需要地图导航
            </label>
          )}
        </div>
        {!!result.missing.length && (
          <div className="st-budget-notice">
            <p>还需补齐：{result.missing.join('、')}。缺项不会按零元计入。</p>
            {result.missing.some((x) => ['工时与运费', '安装件与耗材', '旧件转售'].includes(x)) && (
              <button
                onClick={() =>
                  change({
                    ...plan,
                    labor: plan.labor || '0',
                    consumables: plan.consumables || '0',
                    resale: plan.resale || '0',
                  })
                }
              >
                我已确认未填写的工时、耗材及转售均按 0 元计算
              </button>
            )}
          </div>
        )}
        {result.valid ? (
          <div className="st-budget-ledger">
            <span>
              其他项目净支出 <b>{money(result.fixed)}</b>
            </span>
            <span>
              机动预留 <b>{money(result.reserve!)}</b>
            </span>
            <span>
              本项可用 <b>{money(Math.max(0, result.allowance!))}</b>
            </span>
          </div>
        ) : (
          <p className="st-fine">填写预算、机动金额及其余项目报价后，显示预算内的候选方案。</p>
        )}
        <details className="st-budget-quotes">
          <summary>录入车店报价或海外产品的人民币到手价</summary>
          <p className="st-fine">
            按该版本的销售单位填写。海外标价不自动换汇，也不自动包含运费、税费和安装费。
          </p>
          <div className="st-budget-fields">
            <label>
              报价版本
              <select
                value={quoteId}
                onChange={(e) => {
                  setQuoteId(e.target.value);
                  setQuoteInput(
                    quotes[e.target.value] ? String(quotes[e.target.value].amount) : '',
                  );
                }}
              >
                <option value="">选择型号</option>
                {result.catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              我的人民币单价
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quoteInput}
                onChange={(e) => setQuoteInput(e.target.value)}
              />
            </label>
          </div>
          <button onClick={putQuote}>保存这份报价</button>
          {quoteId && quotes[quoteId] && (
            <button
              onClick={() => {
                const next = { ...quotes };
                delete next[quoteId];
                try {
                  localStorage.setItem(quotesKey, JSON.stringify(next));
                  setQuotes(next);
                  setQuoteInput('');
                  setNotice('已恢复使用公开参考价。');
                } catch {
                  setNotice('保存失败，报价仍保留。');
                }
              }}
            >
              恢复参考价
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
        </details>
        {result.valid && (
          <>
            <div className="st-budget-results-heading">
              <h3>
                预算内的选择 <span>{result.options.length}</span>
              </h3>
              <label className="st-budget-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="搜索预算候选"
                  placeholder="搜索品牌或型号"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <p className="st-fine">
              {result.options.length} 个候选 · {result.noPrice} 个需人民币报价 · {result.overBudget}{' '}
              个超过预算 · {result.mismatch} 个触发已知装配冲突
              {result.unknownSpec ? ` · ${result.unknownSpec} 个缺少所需参数` : ''}
            </p>
            {!!selected.length && (
              <section className="st-budget-comparison" aria-label="候选配件比较">
                <div className="st-section-title">
                  <h3>
                    <GitCompareArrows size={17} /> 候选比较 · {selected.length}/3
                  </h3>
                  <button onClick={() => setCompared([])}>清空比较</button>
                </div>
                <p>最多并排比较 3 款；左右滑动查看。标称重量请结合称量范围比较。</p>
                <div
                  className="st-compare-scroll"
                  role="region"
                  aria-label="配件价格与规格对照表，可横向滚动"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">比较项目</th>
                        {selected.map((o) => (
                          <th key={o.candidate.id} scope="col">
                            {o.candidate.brand && (
                              <span className="st-budget-brand">{o.candidate.brand}</span>
                            )}
                            {o.candidate.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['本项费用', ...selected.map((o) => money(o.cost))],
                        ['选用后净支出', ...selected.map((o) => money(o.total.net))],
                        [
                          '扣除预留后结余',
                          ...selected.map((o) =>
                            money(result.budget! - result.reserve! - o.total.net),
                          ),
                        ],
                        [
                          '价格口径',
                          ...selected.map((o) =>
                            quotes[o.candidate.id]
                              ? `我的人民币报价 · ${quotes[o.candidate.id].date}`
                              : o.candidate.reference
                                ? referencePriceLabel(o.candidate.reference)
                                : '自填报价',
                          ),
                        ],
                        [
                          '标称重量',
                          ...selected.map((o) =>
                            o.candidate.item.weight
                              ? `${o.candidate.item.weight} g · ${o.candidate.item.weightScope}`
                              : '来源未提供',
                          ),
                        ],
                        ...(needs.category === 'wheels'
                          ? [
                              [
                                '框高',
                                ...selected.map((o) =>
                                  o.candidate.product?.selection?.depthMm != null
                                    ? `${o.candidate.product.selection.depthMm} mm`
                                    : '来源未提供',
                                ),
                              ],
                              [
                                '内宽',
                                ...selected.map((o) =>
                                  o.candidate.product?.selection?.innerWidthMm != null
                                    ? `${o.candidate.product.selection.innerWidthMm} mm`
                                    : '来源未提供',
                                ),
                              ],
                            ]
                          : []),
                        [
                          '装配说明',
                          ...selected.map(
                            (o) =>
                              o.candidate.product?.compatibility ||
                              '按具体车架尺码核对把组、座管及随盒附件',
                          ),
                        ],
                      ].map(([name, ...values]) => (
                        <tr key={name}>
                          <th scope="row">{name}</th>
                          {values.map((v, i) => (
                            <td key={selected[i].candidate.id}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {!result.options.length && (
              <p className="st-budget-notice">
                当前没有符合条件的候选。可以调整需求、填写实际报价，或先在安装条件中解决冲突；不必为用满预算而购买。
              </p>
            )}
            <div className="st-budget-options">
              {filtered.slice(0, limit).map((o) => (
                <article key={o.candidate.id}>
                  {o.candidate.image && (
                    <div className="st-budget-photo">
                      <img
                        src={imageUrl(o.candidate.image)}
                        alt={o.candidate.name}
                        loading="lazy"
                      />
                      <PhotoButton
                        asset={photos.find((p) => p.id === o.candidate.id)!}
                        alternatives={photos.filter((p) => p.id !== o.candidate.id)}
                      />
                    </div>
                  )}
                  <small>
                    {result.options[0] === o
                      ? needs.sort === 'price'
                        ? '当前条件下支出最低'
                        : '当前候选中标称重量最低'
                      : '符合当前预算与筛选'}
                  </small>
                  <h3>
                    {o.candidate.brand && (
                      <span className="st-budget-brand">{o.candidate.brand}</span>
                    )}
                    {o.candidate.name}
                  </h3>
                  <p>
                    {money(o.cost)} / 本项
                    {quotes[o.candidate.id]
                      ? ` · 我的报价 ${quotes[o.candidate.id].date}`
                      : ` · ${o.candidate.reference?.market}`}
                  </p>
                  <p className="st-fine">
                    {o.candidate.reference
                      ? referencePriceLabel(o.candidate.reference) +
                        ' · ' +
                        o.candidate.reference.scope
                      : '使用自填报价'}
                    {o.candidate.item.weight
                      ? ` · 标称 ${o.candidate.item.weight} g（${o.candidate.item.weightScope}）`
                      : ''}
                  </p>
                  <dl>
                    <div>
                      <dt>选用后已列项目净支出</dt>
                      <dd>{money(o.total.net)}</dd>
                    </div>
                    <div>
                      <dt>扣除机动金额后结余</dt>
                      <dd>{money(result.budget! - o.total.net - result.reserve!)}</dd>
                    </div>
                    {o.saving !== null && (
                      <div>
                        <dt>比被替换项目{o.saving >= 0 ? '少花' : '多花'}</dt>
                        <dd>{money(Math.abs(o.saving))}</dd>
                      </div>
                    )}
                  </dl>
                  {!!o.total.coverage.length && (
                    <p className="st-fine">
                      整车清单尚未覆盖：
                      {o.total.coverage.map((c) => label(c as Category)).join('、')}
                      ；当前金额不是完整整车预算。
                    </p>
                  )}
                  <details>
                    <summary>规格、价格依据与安装条件</summary>
                    <p>
                      {o.candidate.product?.compatibility || '核对尺码、把组、座管及随盒附件。'}
                    </p>
                    {o.checks.map((n) => (
                      <p key={n.text} className="st-fine">
                        {n.text}
                      </p>
                    ))}
                    <p className="st-fine">{o.candidate.reference?.note}</p>
                    <a
                      href={o.candidate.reference?.source || o.candidate.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      核对来源 ↗
                    </a>
                  </details>
                  <div className="st-inline-actions">
                    <button
                      aria-pressed={selected.some((s) => s.candidate.id === o.candidate.id)}
                      disabled={
                        selected.length >= 3 &&
                        !selected.some((s) => s.candidate.id === o.candidate.id)
                      }
                      onClick={() =>
                        setCompared(
                          selected.some((s) => s.candidate.id === o.candidate.id)
                            ? selected
                                .filter((s) => s.candidate.id !== o.candidate.id)
                                .map((s) => s.candidate.id)
                            : [...selected.map((s) => s.candidate.id), o.candidate.id],
                        )
                      }
                    >
                      {selected.some((s) => s.candidate.id === o.candidate.id)
                        ? '移出比较'
                        : '加入比较'}
                    </button>
                    {selected.some((s) => s.candidate.id === o.candidate.id) && (
                      <button
                        onClick={() =>
                          document
                            .querySelector('.st-budget-comparison')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      >
                        查看对照表 ↑
                      </button>
                    )}
                    {o.candidate.product && (
                      <button onClick={() => detail(o.candidate.product!)}>详细参数</button>
                    )}
                    <button
                      className="st-primary"
                      disabled={o.next.items.length > 60}
                      onClick={() => {
                        change(o.next);
                        setNeeds({
                          ...needs,
                          replace: result.existing?.key || o.candidate.item.key,
                        });
                      }}
                    >
                      {result.existing ? '替换该采购项' : '加入清单'}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!!result.options.length && !filtered.length && (
              <p className="st-budget-notice">没有匹配此名称的候选，试试品牌名或清空搜索。</p>
            )}
            {filtered.length > limit && (
              <button className="st-budget-more" onClick={() => setLimit(limit + 6)}>
                再看 {Math.min(6, filtered.length - limit)} 款 · 已显示{' '}
                {Math.min(limit, filtered.length)}/{filtered.length}
              </button>
            )}
            <p className="st-fine">
              推荐范围限于已收录、有可用报价且满足筛选的版本。未发现冲突不等于装配认证；标称重量不同的称量范围也不能直接视为减重收益。
            </p>
          </>
        )}
      </details>
    </section>
  );
}
