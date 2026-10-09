import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ReferencePrice } from '../types';
import { validPurchaseQuote, type PurchaseQuote } from './model';
import type { Category } from './model';
import { initialSales, type SalesProfile } from './sales';
import SalesFields from './SalesFields';

/** Key by the exact product version so a quote never follows a different SKU. */
export default function PurchaseControls({
  reference,
  quantity = 1,
  full,
  add,
  profile,
  category,
}: {
  reference?: ReferencePrice;
  quantity?: number;
  full: boolean;
  add: (quote: PurchaseQuote) => void;
  profile?: SalesProfile;
  category?: Category;
}) {
  const [quote, setQuote] = useState<PurchaseQuote>({ price: '', condition: 'new' });
  const [sales, setSales] = useState(() => initialSales(profile));
  const valid = validPurchaseQuote(quote);
  return (
    <div className="st-purchase">
      {category && (
        <SalesFields
          value={sales}
          change={setSales}
          category={category}
          profile={profile}
          condition={false}
        />
      )}
      <div className="st-purchase-fields">
        <label>
          购买方式
          <select
            value={quote.condition}
            onChange={(e) =>
              setQuote({ ...quote, condition: e.target.value as PurchaseQuote['condition'] })
            }
          >
            <option value="new">新品</option>
            <option value="takeoff">拆车件</option>
            <option value="used">二手</option>
          </select>
        </label>
        <label>
          我的到手单价 · 元
          <input
            type="text"
            inputMode="decimal"
            value={quote.price}
            placeholder={
              quote.condition !== 'new'
                ? '填写实际报价'
                : reference?.currency === 'CNY'
                  ? `默认 ${reference.amount}`
                  : '填写人民币报价'
            }
            aria-invalid={!!quote.price.trim() && !valid}
            onChange={(e) => setQuote({ ...quote, price: e.target.value })}
          />
        </label>
      </div>
      <p className="st-purchase-hint">
        {quote.price.trim() && !valid
          ? '请填写 0–1,000,000 之间的金额，最多两位小数。'
          : quote.condition !== 'new' && !quote.price.trim()
            ? '二手和拆车件按你的报价计入，不套用新品参考价。'
            : quote.price.trim()
              ? '按你的到手价计入清单，原始参考价仍保留。'
              : reference?.currency === 'CNY'
                ? '可填车店、促销或二手价格；留空沿用参考价。'
                : '海外参考价不自动换算；留空可先加入，稍后补价。'}
        {quantity > 1 && ` 本次加入 ${quantity} 件，按单价 × 数量计算。`}
      </p>
      <button
        className="st-primary"
        disabled={full || !valid}
        onClick={() => add({ ...quote, ...(category ? { sales } : {}) })}
      >
        <Plus size={16} />
        加入清单
      </button>
    </div>
  );
}
