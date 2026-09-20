import { useEffect, useId, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Copy, Plus, X } from 'lucide-react';
import type { Bike, Catalog, GeometrySize } from './types';
import { imageUrl } from './catalog';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { useLibrary } from './Library';
import {
  comparisonFromSearch,
  comparisonSearch,
  geometryFor,
  geometryPoints,
  resolveComparison,
  type ComparisonEntry,
} from './experience';

const colors = ['#486528', '#bd562b', '#326c99'];
const letters = ['A', 'B', 'C'];
type Selection = { bike: Bike; geometry: GeometrySize };
const delta = (value: number) => `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}`;

export default function ComparePage() {
  usePageTitle('整车对比');
  return (
    <PageFrame active="compare" dock={false}>
      <CatalogContent>{(catalog) => <Comparison catalog={catalog} />}</CatalogContent>
    </PageFrame>
  );
}

function Comparison({ catalog }: { catalog: Catalog }) {
  const { library, setComparison } = useLibrary();
  const [entries, setEntries] = useState(() =>
    new URLSearchParams(location.search).has('bikes')
      ? comparisonFromSearch(location.search, catalog.bikes)
      : resolveComparison(library.comparison, catalog.bikes),
  );
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [share, setShare] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [query, setQuery] = useState('');
  const selected: Selection[] = entries.map((entry) => {
    const bike = catalog.bikes.find((b) => b.id === entry.bikeId)!;
    return { bike, geometry: geometryFor(bike, entry.size) };
  });
  const update = (next: ComparisonEntry[]) => {
    setEntries(next);
    setComparison(next);
    setShare('');
    setShareMessage('');
  };
  useEffect(() => {
    history.replaceState(null, '', `${base}${comparisonSearch(entries)}`);
  }, [entries]);
  useEffect(() => {
    setComparison(entries);
  }, []);
  const eligible = catalog.bikes.filter(
    (bike) =>
      !entries.some((entry) => entry.bikeId === bike.id) &&
      `${bike.name} ${bike.family} ${catalog.brands.find((brand) => brand.id === bike.brandId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const componentRows = [
    'frame',
    'shifters',
    'crank',
    'chainrings',
    'cassette',
    'power',
    'wheels',
    'tires',
  ].map((id) => {
    const parts = selected.map(({ bike }) => bike.components.find((part) => part.id === id)!);
    return {
      label: parts[0]?.name || '',
      values: parts.map((part) =>
        [part.title, ...part.specs.map(([name, value]) => `${name}：${value}`)].join('\n'),
      ),
    };
  });
  const specRows = [
    { label: '收录版本', values: selected.map(({ bike }) => bike.edition) },
    { label: '定位', values: selected.map(({ bike }) => bike.kind) },
    { label: '材质', values: selected.map(({ bike }) => bike.material) },
    {
      label: '重量与口径',
      values: selected.map(
        ({ bike }) => `${bike.weightLabel || '整车重量'}：${bike.weight}\n${bike.weightNote}`,
      ),
    },
    ...componentRows,
  ];
  const geometryRows = (
    [
      ['stack', 'Stack / 堆高', 'mm'],
      ['reach', 'Reach / 前伸', 'mm'],
      ['headAngle', '头管角', '°'],
      ['seatAngle', '座管角', '°'],
      ['wheelbase', '轴距', 'mm'],
      ['chainstay', '后下叉', 'mm'],
      ['bbDrop', '五通下沉', 'mm'],
      ['headTube', '头管长度', 'mm'],
    ] as [keyof GeometrySize, string, string][]
  ).map(([key, label, unit]) => ({
    label,
    values: selected.map(
      ({ geometry }) => `${geometry[key] ?? '未公布'}${geometry[key] == null ? '' : ` ${unit}`}`,
    ),
  }));
  return (
    <>
      <header className="page-heading compare-heading">
        <div>
          <span className="eyebrow">THE COMPARISON DESK</span>
          <h1>让差异，有据可看。</h1>
          <p>最多三款，分别选尺码。照片看外观，等比例几何看尺寸。</p>
        </div>
        <button
          className="outline-button"
          onClick={async () => {
            const url = `${location.origin}${base}${comparisonSearch(entries)}`;
            setShare(url);
            try {
              await navigator.clipboard.writeText(url);
              setShareMessage('对比链接已复制，包含当前车型与尺码。');
            } catch {
              setShareMessage('可从下方选中并复制对比链接。');
            }
          }}
        >
          <Copy size={16} />
          分享这组对比
        </button>
      </header>
      {share && (
        <div className="share-result">
          <p role="status">{shareMessage}</p>
          <input
            aria-label="对比分享链接"
            value={share}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
      <div className="compare-selection">
        {selected.map(({ bike, geometry }, index) => (
          <article
            className="compare-choice"
            key={bike.id}
            style={{ borderTopColor: colors[index] }}
          >
            <div className="compare-choice-top">
              <span style={{ color: colors[index] }}>
                {letters[index]} / {index === 0 ? '基准车' : '对比车'}
              </span>
              <button
                aria-label={`移除 ${bike.family}`}
                onClick={() => update(entries.filter((entry) => entry.bikeId !== bike.id))}
              >
                <X size={17} />
              </button>
            </div>
            <a href={`${base}?bike=${bike.id}`}>
              <img src={imageUrl(bike.image)} alt={bike.name} />
              <h2>{bike.family}</h2>
            </a>
            <p>{bike.build}</p>
            <small>{bike.edition}</small>
            <div className="compare-size">
              <label>
                车架尺码
                <select
                  aria-label={`${bike.family} 车架尺码`}
                  value={geometry.size}
                  onChange={(e) =>
                    update(
                      entries.map((entry) =>
                        entry.bikeId === bike.id ? { ...entry, size: e.target.value } : entry,
                      ),
                    )
                  }
                >
                  {bike.geometry.sizes.map((g) => (
                    <option key={g.size} value={g.size}>
                      {g.size}
                    </option>
                  ))}
                </select>
              </label>
              {index > 0 && (
                <button
                  className="text-link"
                  onClick={() => update([entries[index], ...entries.filter((_, i) => i !== index)])}
                >
                  设为基准
                </button>
              )}
            </div>
          </article>
        ))}
        {entries.length < 3 && (
          <div className="compare-add">
            <Plus size={28} strokeWidth={1} />
            <h2>{entries.length ? '再多看一台。' : '从一台熟悉的车开始。'}</h2>
            <p>搜索品牌或车型，加入对比。</p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：喜德盛、Tarmac"
              aria-label="搜索待对比车型"
            />
            <select
              aria-label="添加对比车型"
              value=""
              onChange={(e) => {
                const bike = catalog.bikes.find((b) => b.id === e.target.value);
                if (bike)
                  update([...entries, { bikeId: bike.id, size: bike.geometry.defaultSize }]);
                setQuery('');
              }}
            >
              <option value="">
                {eligible.length ? `选择车型（${eligible.length}）` : '没有匹配的车型'}
              </option>
              {eligible.map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {catalog.brands.find((b) => b.id === bike.brandId)?.name} · {bike.family}
                </option>
              ))}
            </select>
            {!entries.length && (
              <a
                className="text-link"
                href={`${base}${comparisonSearch([
                  { bikeId: 'tarmac-sl6', size: '56' },
                  { bikeId: 'tarmac-sl8', size: '56' },
                ])}`}
              >
                试试 SL6 与 SL8 <ArrowRight size={16} />
              </a>
            )}
          </div>
        )}
      </div>
      {!!selected.length && (
        <>
          <p className="comparison-note">
            照片按版面适配，未进行实物比例标定。选尺码只更新车架几何；零件规格保留收录版本及其注明的参考尺码。尺码名称相同，不代表实际尺寸相同。
          </p>
          <GeometryOverlay selected={selected} />
          {selected.length > 1 && (
            <div className="geometry-deltas">
              {selected.slice(1).map(({ bike, geometry }, i) => (
                <div key={bike.id}>
                  <span style={{ color: colors[i + 1] }}>
                    {letters[i + 1]} − A / 相对 {selected[0].bike.family} ·{' '}
                    {selected[0].geometry.size}
                  </span>
                  <h3>
                    {bike.family} · {geometry.size}
                  </h3>
                  <div>
                    <strong>
                      {delta(geometry.stack - selected[0].geometry.stack)}
                      <small> mm Stack</small>
                    </strong>
                    <strong>
                      {delta(geometry.reach - selected[0].geometry.reach)}
                      <small> mm Reach</small>
                    </strong>
                  </div>
                  <p>正值表示车架前端更高 / 更前伸。实际手部位置还取决于把立、垫圈和车把。</p>
                </div>
              ))}
            </div>
          )}
          {selected.some(({ bike }) => bike.kind === 'TT 计时') && (
            <p className="comparison-note emphasis">
              这组包含 TT 车。车架 Stack / Reach 不等于托肘坐标，不能据此直接推断计时骑姿。
            </p>
          )}
          <div className="comparison-table-heading">
            <h2>把参数放在一起。</h2>
            <label>
              <input
                type="checkbox"
                checked={onlyDifferences}
                onChange={(e) => setOnlyDifferences(e.target.checked)}
                disabled={selected.length < 2}
              />
              只看差异
            </label>
          </div>
          <ComparisonTable
            title="车架几何"
            rows={geometryRows}
            selected={selected}
            onlyDifferences={onlyDifferences}
          />
          <ComparisonTable
            title="整车配置"
            rows={specRows}
            selected={selected}
            onlyDifferences={onlyDifferences}
          />
          <p className="comparison-note">
            重量保留厂商给出的整车 / 车架、尺码与配置口径，不做重量排名。未公布的尺寸保持缺项。
          </p>
          <details className="comparison-sources">
            <summary>
              逐车来源与测量说明 <span>展开查看</span>
            </summary>
            {selected.map(({ bike }) => (
              <div key={bike.id}>
                <h3>
                  {bike.family} · {bike.edition}
                </h3>
                <p>{bike.geometry.note}</p>
                <p>{bike.imageNote}</p>
                <a
                  className="source-link"
                  href={bike.geometry.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  {bike.geometry.sourceLabel} <ArrowUpRight size={14} />
                </a>
                <a className="source-link" href={bike.source} target="_blank" rel="noreferrer">
                  整车配置 · 核对 {bike.checkedAt} <ArrowUpRight size={14} />
                </a>
              </div>
            ))}
          </details>
        </>
      )}
    </>
  );
}

function ComparisonTable({
  title,
  rows,
  selected,
  onlyDifferences,
}: {
  title: string;
  rows: { label: string; values: string[] }[];
  selected: Selection[];
  onlyDifferences: boolean;
}) {
  const visible = rows.filter(
    (row) => !onlyDifferences || selected.length < 2 || new Set(row.values).size > 1,
  );
  return (
    <div
      className="bike-comparison-table"
      tabIndex={0}
      role="region"
      aria-label={`${title}对比表，可横向滚动`}
    >
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">项目</th>
            {selected.map(({ bike, geometry }, index) => (
              <th scope="col" key={bike.id}>
                <span style={{ color: colors[index] }}>{letters[index]}</span> {bike.family}
                <small>{title === '车架几何' ? `${geometry.size} 码` : '收录整车配置'}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length ? (
            visible.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={selected.length + 1} className="identical-row">
                <Check size={16} />
                所选尺码的这些参数相同。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GeometryOverlay({ selected }: { selected: Selection[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [front, setFront] = useState(false);
  const patternId = useId();
  const points = selected.map(({ geometry }) => geometryPoints(geometry));
  const minX = Math.min(...points.map((p) => p.headTop.x)) - 80;
  const maxX = Math.max(...points.map((p) => p.headBottom.x)) + 100;
  const minY = Math.min(...points.map((p) => p.headTop.y)) - 70;
  const maxY = Math.max(...points.map((p) => p.headBottom.y)) + 50;
  return (
    <section className="geometry-overlay" aria-label="等比例几何叠图">
      <div className="overlay-heading">
        <div>
          <span className="eyebrow">GEOMETRY OVERLAY</span>
          <h2>同一个五通，不同的姿态。</h2>
        </div>
        <button className="outline-button" aria-pressed={front} onClick={() => setFront(!front)}>
          {front ? '查看全部尺寸' : '放大前端差异'}
        </button>
      </div>
      <div className="overlay-legend">
        {selected.map(({ bike, geometry }, index) => (
          <button
            key={bike.id}
            aria-pressed={!hidden.includes(bike.id)}
            onClick={() =>
              setHidden((items) =>
                items.includes(bike.id)
                  ? items.filter((id) => id !== bike.id)
                  : [...items, bike.id],
              )
            }
          >
            <i style={{ background: colors[index], opacity: hidden.includes(bike.id) ? 0.2 : 1 }} />
            {letters[index]} · {bike.family}{' '}
            <small>
              {geometry.size} 码 · {geometry.stack} / {geometry.reach}
            </small>
          </button>
        ))}
      </div>
      <svg
        viewBox={front ? `${minX} ${minY} ${maxX - minX} ${maxY - minY}` : '-455 -740 1250 850'}
        role="img"
        aria-label="五通对齐、相同毫米比例的车架尺寸叠图。虚线表示尺寸投影和座管轴线，非实际管型。"
      >
        <defs>
          <pattern id={patternId} width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 H 0 V 50" fill="none" stroke="#dde3d4" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="-500" y="-790" width="1400" height="900" fill={`url(#${patternId})`} />
        <path d="M-500 0H900 M0 -790V110" stroke="#8e9e81" strokeWidth="1" />
        {selected.map(({ bike, geometry }, i) => {
          const p = points[i];
          const point = (v: { x: number; y: number }) => `${v.x} ${v.y}`;
          return (
            <g
              key={bike.id}
              fill="none"
              stroke={colors[i]}
              strokeWidth={front ? 1.6 : 3}
              opacity={hidden.includes(bike.id) ? 0 : 0.9}
            >
              <path
                d={`M0 0 L${point(p.headBottom)} L${point(p.headTop)} M0 0 L${point(p.rear)}`}
              />
              <path
                d={`M0 0 L${point(p.seat)}`}
                strokeDasharray={p.seatMeasured ? undefined : '9 7'}
              />
              {p.seatMeasured && (
                <path
                  d={`M${point(p.seat)} L${point(p.headTop)} M${point(p.seat)} L${point(p.rear)}`}
                  strokeDasharray="9 7"
                />
              )}
              {p.front && (
                <>
                  <path d={`M${point(p.headBottom)} L${point(p.front)}`} strokeDasharray="9 7" />
                  <circle cx={p.front.x} cy={p.front.y} r="5" />
                </>
              )}
              <path
                d={`M0 ${p.headTop.y} H${p.headTop.x} V0`}
                strokeDasharray="5 8"
                strokeWidth="1"
              />
              <circle cx={p.headTop.x} cy={p.headTop.y} r={front ? 3 : 5} fill={colors[i]} />
              <circle cx={p.rear.x} cy={p.rear.y} r="5" />
            </g>
          );
        })}
        <circle cx="0" cy="0" r="7" fill="#1d231f" />
        <text x="18" y="34" fill="#486528" fontSize="25">
          BB / 五通对齐
        </text>
        <path d="M-430 70H-330 M-430 65V75 M-330 65V75" stroke="#486528" strokeWidth="2" />
        <text x="-380" y="99" textAnchor="middle" fill="#486528" fontSize="22">
          100 mm
        </text>
      </svg>
      <p>
        图例数字为 Stack /
        Reach（mm）。尺寸骨架仅连接测量参考点，不代表真实管型或后叉接点。虚线座管轴线不代表已知长度；未公布轴距时不绘制前轴。点击图例可显示
        / 隐藏。
      </p>
    </section>
  );
}
