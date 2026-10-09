import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileDown, FileUp, Plus, ReceiptText } from 'lucide-react';
import { money, type Plan } from './model';
import { conditionLabels, salesText } from './sales';
import {
  assessQuote,
  createQuote,
  localDate,
  matchesRequest,
  parseQuote,
  quoteDocument,
  quoteReport,
  quoteStorageKey,
  readQuoteDocument,
  reviseQuote,
  stockLabels,
  updateQuoteLine,
  type MerchantQuote,
  type QuoteLine,
} from './quotes';

function readQuotes(): MerchantQuote[] {
  try {
    const data = JSON.parse(localStorage.getItem(quoteStorageKey) || '[]');
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.slice(0, 30).flatMap((raw) => {
      const q = parseQuote(raw);
      if (!q || seen.has(q.id)) return [];
      seen.add(q.id);
      return [q];
    });
  } catch {
    return [];
  }
}
export default function QuoteWorkbench({
  plan,
  exportFile,
  editPlan,
}: {
  plan: Plan;
  exportFile: (blob: Blob, name: string) => Promise<void>;
  editPlan: () => void;
}) {
  const [quotes, setQuotes] = useState<MerchantQuote[]>(readQuotes);
  const [editing, setEditing] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('报价保存在本机，可导出备份。');
  const [removed, setRemoved] = useState<MerchantQuote | null>(null);
  const [pending, setPending] = useState<MerchantQuote | null>(null);
  const [today, setToday] = useState(localDate());
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const save = (next: MerchantQuote[]) => {
    if (next.length > 30) {
      setMessage('最多保存 30 份报价，请先导出并移除旧报价。');
      return false;
    }
    setQuotes(next);
    if (next.some((q) => !parseQuote(q))) {
      setMessage('金额格式无效；修正后自动保存。最多两位小数，不收费请填 0。');
      return false;
    }
    try {
      localStorage.setItem(quoteStorageKey, JSON.stringify(next));
      setMessage('报价已保存在本机');
      return true;
    } catch {
      setMessage('本机保存失败，请导出备份。');
      return false;
    }
  };
  const update = (next: MerchantQuote) =>
    save(
      quotes.map((q) => (q.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : q)),
    );
  const active = quotes.find((q) => q.id === editing);
  const compare = quotes.filter((q) => selected.includes(q.id));
  const eligible = compare.filter((q) => assessQuote(q, plan, today).comparable);
  const lowest =
    eligible.length >= 2
      ? Math.min(...eligible.map((q) => assessQuote(q, plan, today).total!))
      : null;
  const output = async (text: string, name: string, json = false) => {
    try {
      await exportFile(
        new Blob([text], { type: json ? 'application/json' : 'text/plain;charset=utf-8' }),
        name,
      );
      setMessage('文件已生成，请保存到自己的文件夹。');
    } catch {
      setMessage('导出未完成，请重试。');
    }
  };
  const add = () => {
    const quote = createQuote(plan, today);
    if (!quote.request.length) {
      setMessage('先在装车台加入要购买的零件。');
      return;
    }
    if (save([quote, ...quotes])) {
      setEditing(quote.id);
      setSelected((s) => [...s, quote.id].slice(-3));
    }
  };
  return (
    <section className="st-panel st-quotes">
      <div className="st-section-title">
        <div>
          <span className="st-kicker">询价与比较</span>
          <h2>商家报价单</h2>
          <p>把收到的报价放在一起，核对版本、附件和交付费用。</p>
        </div>
        <ReceiptText size={26} />
      </div>
      <p className="st-quote-intro">
        由你录入车店或供货商的报价，也可导入循风报价文件。当前不连接商家库存，不自动发送询价。
      </p>
      <div className="st-inline-actions">
        <button className="st-primary" onClick={add} disabled={quotes.length >= 30}>
          <Plus size={17} />
          按当前清单新建报价
        </button>
        <button onClick={() => file.current?.click()}>
          <FileUp size={17} />
          导入报价
        </button>
        <button onClick={editPlan}>编辑订购规格</button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            if (f.size > 512000) throw new Error('报价文件超过 500 KB');
            setPending(readQuoteDocument(await f.text()));
          } catch (error) {
            setMessage(error instanceof Error ? error.message : '文件无法读取');
          }
        }}
      />
      <p className="st-quote-message" role="status">
        {message}
      </p>
      {pending && (
        <div className="st-quote-import">
          <h3>导入预览</h3>
          <p>
            {pending.merchant || '未命名商家'} · {pending.request.length} 项 · 报价日{' '}
            {pending.date || '未填写'}
          </p>
          <p>
            {matchesRequest(pending, plan) ? '对应当前清单' : '对应不同的清单，将保留为独立报价'}
          </p>
          <div className="st-inline-actions">
            <button
              className="st-primary"
              onClick={() => {
                const q = { ...pending, id: crypto.randomUUID() };
                if (save([q, ...quotes])) {
                  setEditing(q.id);
                  setPending(null);
                }
              }}
            >
              确认导入
            </button>
            <button onClick={() => setPending(null)}>取消</button>
          </div>
        </div>
      )}
      {!quotes.length && (
        <div className="st-empty">
          <ReceiptText size={34} />
          <h3>先保留一份真实报价</h3>
          <p>
            加入采购项目后，新建报价单。新品、拆车件和二手分开记录；缺少价格的项目不会算作免费。
          </p>
        </div>
      )}
      {!!quotes.length && (
        <div className="st-quote-list" aria-label="已保存报价">
          {quotes.map((q) => {
            const a = assessQuote(q, plan, today);
            return (
              <article key={q.id} className={q.id === editing ? 'is-editing' : ''}>
                <div>
                  <h3>{q.merchant || '未命名商家'}</h3>
                  <small>
                    {q.date || '报价日期未填写'} · {q.request.length} 项
                    {q.revisionOf && ' · 修订版'}
                  </small>
                  <strong>
                    {a.total === null ? '已知费用 ' : '交付价 '}
                    {money(a.total ?? a.known)}
                  </strong>
                  <span className={`st-quote-badge ${a.comparable ? 'ready' : ''}`}>
                    {a.comparable
                      ? '同规格可比较'
                      : !matchesRequest(q, plan)
                        ? '清单已变化'
                        : a.issues.includes('报价已过期')
                          ? '已过期'
                          : '需补充或有差异'}
                  </span>
                </div>
                <div className="st-quote-list-actions">
                  <label className="st-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(q.id)}
                      disabled={!selected.includes(q.id) && selected.length >= 3}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, q.id]
                            : selected.filter((id) => id !== q.id),
                        )
                      }
                    />
                    加入对比
                  </label>
                  <button
                    aria-label={`编辑${q.merchant || '未命名商家'}报价`}
                    onClick={() => setEditing(q.id)}
                  >
                    编辑报价
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {active && (
        <QuoteEditor
          key={active.id}
          quote={active}
          plan={plan}
          today={today}
          update={update}
          close={() => setEditing('')}
          exportQuote={() => output(quoteDocument(active), '商家报价.velodex-quote.json', true)}
          exportText={() => output(quoteReport(active, plan, today), '商家报价.txt')}
          revise={() => {
            const q = reviseQuote(active);
            if (save([q, ...quotes])) setEditing(q.id);
          }}
          remove={() => {
            if (save(quotes.filter((q) => q.id !== active.id))) {
              setRemoved(active);
              setEditing('');
              setSelected((s) => s.filter((id) => id !== active.id));
            }
          }}
        />
      )}
      {removed && (
        <button
          onClick={() => {
            if (save([removed, ...quotes])) setRemoved(null);
          }}
        >
          恢复刚移除的报价
        </button>
      )}
      {!!compare.length && (
        <section className="st-quote-comparison" aria-label="报价对比">
          <div className="st-section-title">
            <div>
              <h3>整单比较</h3>
              <p>最多三份。只在同一清单、规格范围一致、费用完整且有效的报价之间比较价格。</p>
            </div>
            <button
              onClick={() =>
                output(
                  compare.map((q) => quoteReport(q, plan, today)).join('\n\n──────────\n\n'),
                  '报价对比.txt',
                )
              }
            >
              <FileDown size={17} />
              导出对比
            </button>
          </div>
          <div className="st-quote-compare-grid">
            {compare.map((q) => {
              const a = assessQuote(q, plan, today);
              return (
                <article key={q.id}>
                  <h3>{q.merchant || '未命名商家'}</h3>
                  <strong className="st-quote-amount">{money(a.total ?? a.known)}</strong>
                  <p>{a.total === null ? '已知费用，尚非整单总价' : '含税交付价，不扣旧件转售'}</p>
                  {lowest !== null && a.comparable && (
                    <b className="st-quote-badge ready">
                      {a.total === lowest
                        ? '所选同规格报价中最低'
                        : `比最低报价多 ${money(a.total! - lowest)}`}
                    </b>
                  )}
                  <dl>
                    {[
                      ['有效期', q.validUntil || '未填写'],
                      ['工时', q.labor],
                      ['运费', q.shipping],
                      ['耗材', q.consumables],
                      ['优惠', q.discount],
                      [
                        '税费',
                        q.tax === 'included'
                          ? '已含税'
                          : q.tax === 'extra'
                            ? q.taxAmount
                            : '未说明',
                      ],
                      ['服务', q.service || '未列明'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v || '未报价'}</dd>
                      </div>
                    ))}
                  </dl>
                  {q.lines.map((l) => (
                    <div className="st-quote-delivery" key={l.key}>
                      <b>{q.request.find((i) => i.key === l.key)?.name}</b>
                      <p>{l.price ? `${l.quantity} × ¥${l.price}` : '单价未提供'}</p>
                      <p>{l.offered || '版本以清单要求为准'}</p>
                      <p>
                        随附：{l.included || '未列明'} · 另购：{l.excluded || '未列明'}
                      </p>
                      <p>
                        {conditionLabels[l.condition]} · {stockLabels[l.stock]} {l.leadTime}
                      </p>
                      <p>保修：{l.warranty || '未列明'}</p>
                    </div>
                  ))}
                  {a.issues.length ? (
                    <details className="st-quote-issues" open>
                      <summary>{a.issues.length} 项影响比较</summary>
                      <ul>
                        {a.issues.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="st-quote-ok">已按当前清单核对，同规格费用可比较。</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

function QuoteEditor({
  quote: q,
  plan,
  today,
  update,
  close,
  revise,
  remove,
  exportQuote,
  exportText,
}: {
  quote: MerchantQuote;
  plan: Plan;
  today: string;
  update: (q: MerchantQuote) => void;
  close: () => void;
  revise: () => void;
  remove: () => void;
  exportQuote: () => void;
  exportText: () => void;
}) {
  const line = (key: string, patch: Partial<QuoteLine>) =>
    update({ ...q, lines: q.lines.map((l) => (l.key === key ? updateQuoteLine(l, patch) : l)) });
  const a = assessQuote(q, plan, today);
  return (
    <section className="st-quote-editor" aria-label="编辑报价单">
      <div className="st-section-title">
        <h3>{q.merchant || '新报价'} · 编辑</h3>
        <button onClick={close}>
          <ArrowLeft size={16} />
          收起编辑
        </button>
      </div>
      {!matchesRequest(q, plan) && (
        <p className="st-quote-alert">
          这份报价保留了询价时的清单。当前方案已不同；按新清单另建报价即可重新比较。
        </p>
      )}
      <div className="st-fields">
        <label>
          商家名称
          <input
            value={q.merchant}
            maxLength={200}
            onChange={(e) => update({ ...q, merchant: e.target.value })}
          />
        </label>
        <label>
          报价来源 / 渠道
          <input
            value={q.channel}
            maxLength={600}
            placeholder="例如门店报价、店铺链接"
            onChange={(e) => update({ ...q, channel: e.target.value })}
          />
        </label>
        <label>
          报价日期
          <input
            type="date"
            value={q.date}
            onInput={(e) => update({ ...q, date: e.currentTarget.value })}
            onChange={(e) => update({ ...q, date: e.target.value })}
          />
        </label>
        <label>
          有效期至
          <input
            type="date"
            value={q.validUntil}
            onInput={(e) => update({ ...q, validUntil: e.currentTarget.value })}
            onChange={(e) => update({ ...q, validUntil: e.target.value })}
          />
        </label>
      </div>
      <p className="st-fine">
        所有金额以人民币填写。价格留空表示未提供；商家未说明的服务与保修请如实保留。
        “已核对”由录入者确认，不代表平台认证；修改版本、数量、成色或附件后需要重新核对。
      </p>
      <div className="st-quote-lines">
        {q.request.map((item, index) => {
          const l = q.lines.find((l) => l.key === item.key)!;
          return (
            <details key={l.key} open={q.request.length === 1 ? true : undefined}>
              <summary>
                <span>
                  {index + 1}. {item.name || '自定义零件'}
                </span>
                <b>{l.price ? `${l.quantity} × ¥${l.price}` : '填写报价'}</b>
              </summary>
              <p className="st-quote-request">
                清单要求：{item.sales ? salesText(item.sales) : item.variant || '尚未填写订购规格'}
              </p>
              <div className="st-fields">
                <Money label="单价 / 元" value={l.price} set={(price) => line(l.key, { price })} />
                <label>
                  销售单位数量
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={l.quantity}
                    onChange={(e) => {
                      const n = +e.target.value;
                      if (Number.isInteger(n) && n >= 1 && n <= 20) line(l.key, { quantity: n });
                    }}
                  />
                </label>
                <label>
                  商家提供的成色
                  <select
                    value={l.condition}
                    onChange={(e) =>
                      line(l.key, { condition: e.target.value as QuoteLine['condition'] })
                    }
                  >
                    {Object.entries(conditionLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  版本与附件范围
                  <select
                    value={l.match}
                    onChange={(e) => line(l.key, { match: e.target.value as QuoteLine['match'] })}
                  >
                    <option value="unreviewed">尚未核对</option>
                    <option value="same">已核对，与清单一致</option>
                    <option value="alternative">商家提供替代规格</option>
                  </select>
                </label>
              </div>
              <label>
                商家具体版本 / 替代型号
                <input
                  value={l.offered}
                  maxLength={600}
                  placeholder="可填写商家 SKU、型号或规格差异"
                  onChange={(e) => line(l.key, { offered: e.target.value })}
                />
              </label>
              <div className="st-fields">
                <label>
                  随附附件
                  <input
                    value={l.included}
                    maxLength={600}
                    placeholder="没有请填无"
                    onChange={(e) => line(l.key, { included: e.target.value })}
                  />
                </label>
                <label>
                  不含 / 另购
                  <input
                    value={l.excluded}
                    maxLength={600}
                    onChange={(e) => line(l.key, { excluded: e.target.value })}
                  />
                </label>
                <label>
                  供货状态
                  <select
                    value={l.stock}
                    onChange={(e) => line(l.key, { stock: e.target.value as QuoteLine['stock'] })}
                  >
                    {Object.entries(stockLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  交期说明
                  <input
                    value={l.leadTime}
                    maxLength={600}
                    placeholder="例如付款后 3 个工作日"
                    onChange={(e) => line(l.key, { leadTime: e.target.value })}
                  />
                </label>
              </div>
              <label>
                保修与购买凭证
                <input
                  value={l.warranty}
                  maxLength={600}
                  placeholder="渠道、期限、凭证；无保修也请写明"
                  onChange={(e) => line(l.key, { warranty: e.target.value })}
                />
              </label>
            </details>
          );
        })}
      </div>
      <h3>交付费用</h3>
      <div className="st-fields">
        {(
          [
            ['labor', '安装工时 / 元'],
            ['shipping', '运费 / 元'],
            ['consumables', '安装件与耗材 / 元'],
            ['discount', '整单优惠 / 元'],
          ] as const
        ).map(([k, label]) => (
          <Money key={k} label={label} value={q[k]} set={(v) => update({ ...q, [k]: v })} />
        ))}
        <label>
          税费口径
          <select
            value={q.tax}
            onChange={(e) =>
              update({ ...q, tax: e.target.value as MerchantQuote['tax'], taxAmount: '' })
            }
          >
            <option value="unspecified">商家未说明</option>
            <option value="included">上述金额已含税</option>
            <option value="extra">另付税费</option>
          </select>
        </label>
        {q.tax === 'extra' && (
          <Money
            label="另付税费 / 元"
            value={q.taxAmount}
            set={(taxAmount) => update({ ...q, taxAmount })}
          />
        )}
      </div>
      <p className="st-fine">
        不收费请填
        0。已含在配件单价中的安装件和耗材不要重复计入。旧件转售属于你的预算，未在商家交付价中抵扣。
      </p>
      <label>
        安装、交付与售后服务
        <textarea
          value={q.service}
          maxLength={2000}
          rows={2}
          onChange={(e) => update({ ...q, service: e.target.value })}
        />
      </label>
      <label>
        报价备注
        <textarea
          value={q.notes}
          maxLength={3000}
          rows={2}
          onChange={(e) => update({ ...q, notes: e.target.value })}
        />
      </label>
      <div className="st-quote-total">
        <span>{a.total === null ? '已知费用' : '含税交付价'}</span>
        <strong>{money(a.total ?? a.known)}</strong>
        <p>
          {a.comparable
            ? '已按当前清单核对，可参与同规格比较。'
            : `${a.issues.length} 项需补充或有差异，可在下方比较区查看。`}
        </p>
      </div>
      <div className="st-inline-actions">
        <button disabled={!parseQuote(q)} onClick={exportQuote}>
          导出报价文件
        </button>
        <button disabled={!parseQuote(q)} onClick={exportText}>
          导出文字报价
        </button>
        <button disabled={!parseQuote(q)} onClick={revise}>
          另存修订版
        </button>
        <button onClick={remove}>移除这份报价</button>
      </div>
    </section>
  );
}
function Money({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        maxLength={24}
        placeholder="不收费填 0"
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
