import { useId } from 'react';
import { categoryFields, conditionLabels, type SalesProfile, type SalesSelection } from './sales';
import type { Category } from './model';

export default function SalesFields({
  value,
  change,
  profile,
  category,
  condition = true,
}: {
  value: SalesSelection;
  change: (s: SalesSelection) => void;
  profile?: SalesProfile;
  category: Category;
  condition?: boolean;
}) {
  const fields = profile?.fields || categoryFields(category);
  const id = useId();
  return (
    <details className="st-sales-fields">
      <summary>
        订购规格{' '}
        <span>
          {fields.filter((f) => value.attributes[f.key]?.trim()).length} / {fields.length} 项已填
        </span>
      </summary>
      <p className="st-fine">
        选择目录规格，或填写自己的销售版本。目录选项不代表现货，也不代表任意组合均可订购。
      </p>
      <div className="st-fields">
        <label>
          销售地区
          <input
            value={value.market}
            maxLength={200}
            placeholder="例如中国大陆"
            onChange={(e) => change({ ...value, market: e.target.value })}
          />
        </label>
        {condition && (
          <label>
            成色
            <select
              value={value.condition}
              onChange={(e) =>
                change({ ...value, condition: e.target.value as SalesSelection['condition'] })
              }
            >
              {Object.entries(conditionLabels).map(([v, text]) => (
                <option key={v} value={v}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        )}
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              list={f.options?.length ? `${id}-${f.key}` : undefined}
              value={value.attributes[f.key] || ''}
              maxLength={300}
              placeholder="按所购版本填写"
              onChange={(e) =>
                change({ ...value, attributes: { ...value.attributes, [f.key]: e.target.value } })
              }
            />
            {!!f.options?.length && (
              <datalist id={`${id}-${f.key}`}>
                {f.options.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            )}
          </label>
        ))}
      </div>
      <label>
        一个销售单位包含什么
        <input
          value={value.scope}
          maxLength={600}
          placeholder="例如前后轮一对，或一条轮胎"
          onChange={(e) => change({ ...value, scope: e.target.value })}
        />
      </label>
      <div className="st-fields">
        <label>
          要求随附
          <input
            value={value.included}
            maxLength={600}
            placeholder="气嘴、胎垫、锁片等；没有可填无"
            onChange={(e) => change({ ...value, included: e.target.value })}
          />
        </label>
        <label>
          不包含 / 另外采购
          <input
            value={value.excluded}
            maxLength={600}
            placeholder="例如碟片、飞轮另购"
            onChange={(e) => change({ ...value, excluded: e.target.value })}
          />
        </label>
      </div>
      {profile && (
        <p className="st-fine">
          目录依据：{profile.checkedAt} ·{' '}
          <a href={profile.source} target="_blank" rel="noreferrer">
            查阅原始资料 ↗
          </a>
          。自行填写的规格随方案保存。
        </p>
      )}
    </details>
  );
}
