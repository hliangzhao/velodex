import {
  slots,
  weightOf,
  weightBreakdown,
  totals,
  type DreamBuild,
  type Slot,
  type BuildItem,
} from './workshop';

export default function WeightAssistant({
  build,
  update,
}: {
  build: DreamBuild;
  update: (slot: Slot, patch: Partial<BuildItem>) => void;
}) {
  const summary = weightBreakdown(build),
    total = totals(build, 'grams');
  return (
    <details className="work-panel weight-assistant">
      <summary>
        <span>
          重量助手 <small>可选</small>
        </span>
        <span>{total.known ? `${total.known} 项已有重量资料` : '不知道重量，也能完成装车'}</span>
      </summary>
      <p>
        有完整称重范围对应的官方重量时自动采用；没有资料就跳过。想进一步估重，再补实测值即可。这里的重量是参考相加，不是整车称重。
      </p>
      <div className="weight-legend">
        <span>{summary.official} 项官方参考</span>
        <span>{summary.manual} 项已保存 / 自填</span>
        <span>{summary.skipped} 项未计重</span>
      </div>
      <div className="weight-rows">
        {slots.map(([slot, label, scope]) => {
          const item = build.items[slot],
            weight = weightOf(item),
            mode = item.weightMode ?? (item.grams.trim() ? 'manual' : 'auto');
          return (
            <div className="weight-row" key={slot}>
              <div className="weight-row-head">
                <strong>{label}</strong>
                <b>
                  {weight.grams === null ? '暂不计重' : `${weight.grams.toLocaleString('zh-CN')} g`}
                </b>
              </div>
              <small>{scope}</small>
              <label className="sr-label">
                {label}重量方式
                <select
                  aria-label={`${label}重量方式`}
                  value={mode}
                  onChange={(e) =>
                    update(slot, { weightMode: e.target.value as BuildItem['weightMode'] })
                  }
                >
                  <option value="auto">
                    {weight.reference ? '自动采用官方参考' : '自动查找 · 暂无对应资料'}
                  </option>
                  <option value="manual">填写自己的数值</option>
                  <option value="skip">暂不计重</option>
                </select>
              </label>
              {mode === 'manual' && (
                <label>
                  {label}自填重量 / g
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.1"
                    placeholder="选填；0 表示明确不计入"
                    value={item.grams}
                    onChange={(e) => update(slot, { grams: e.target.value })}
                  />
                </label>
              )}
              {mode === 'auto' &&
                (weight.reference ? (
                  <p className="work-note">
                    <span className="weight-source">官方参考</span> {weight.reference.label}。
                    {weight.reference.note}{' '}
                    <a href={weight.reference.source} target="_blank" rel="noreferrer">
                      核对来源 ↗
                    </a>{' '}
                    · {weight.reference.checkedAt}
                  </p>
                ) : (
                  <p className="work-note">
                    暂无这一完整项目的可靠重量；已跳过，不影响保存或生成海报。
                  </p>
                ))}
              {mode === 'manual' && (
                <p className="work-note">
                  保留你填写或旧清单中的值，不将它标为官方重量。切回自动不会删除自填值。
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="work-note">
        轮组、轮胎、脚踏按一对计算；车架组含前叉与座管，不能把“裸架重量”直接套用。胎垫、阀嘴和密封液按所选轮组的称重范围避免重复计入。未选择具体齿比、曲柄长度及制动版本的套件，不拼凑一个精确总重。
      </p>
    </details>
  );
}
