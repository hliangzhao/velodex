import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { loadParts } from './catalog';
import type { PartsCatalog } from './types';
import DreamBuild from './DreamBuild';
import { amount, fitCheck, gear, upgrade, wheelFit } from './workshop';
import './workshop.css';
const StructureLab = lazy(() => import('./StructureLab'));
const InterfaceTool = lazy(() => import('./InterfaceTool'));
const tabs = [
  ['build', '梦幻装车单'],
  ['gears', '齿比计算器'],
  ['fit', '轮胎 × 轮圈'],
  ['interfaces', '装车接口核对'],
  ['upgrade', '升级前后'],
  ['structures', '结构观察室'],
] as const;
export default function WorkshopPage() {
  usePageTitle('工坊');
  const [parts, setParts] = useState<PartsCatalog>();
  const [error, setError] = useState(false);
  const tool = new URLSearchParams(location.search).get('tool') || 'build';
  const load = () => {
    setError(false);
    loadParts()
      .then(setParts)
      .catch(() => setError(true));
  };
  useEffect(load, []);
  return (
    <PageFrame active="workshop">
      <div className="work-heading">
        <div>
          <span className="eyebrow">THE WORKSHOP / 好奇心的工作台</span>
          <h1>把喜欢，装成一台车。</h1>
          <p>算一次齿比，拆开一个结构，为下一次骑行多想一点。</p>
        </div>
        <a href={`${base}?view=feedback`}>
          给工坊提个建议 <ArrowUpRight size={16} />
        </a>
      </div>
      <nav className="work-tabs" aria-label="工坊工具">
        {tabs.map(([id, label]) => (
          <a
            key={id}
            href={`${base}?view=workshop&tool=${id}`}
            aria-current={tool === id ? 'page' : undefined}
            className={tool === id ? 'active' : ''}
          >
            {label}
          </a>
        ))}
      </nav>
      {tool === 'interfaces' ? (
        <Suspense fallback={<p>正在准备接口核对…</p>}>
          <InterfaceTool />
        </Suspense>
      ) : tool === 'gears' ? (
        <GearTool />
      ) : tool === 'upgrade' ? (
        <UpgradeTool />
      ) : tool === 'structures' ? (
        <Suspense fallback={<p>正在打开结构观察室…</p>}>
          <StructureLab />
        </Suspense>
      ) : !parts ? (
        <div className="work-panel" role="status">
          {error ? (
            <>
              <p>配件资料暂时无法读取。</p>
              <button onClick={load}>重试</button>
            </>
          ) : (
            '正在准备工作台…'
          )}
        </div>
      ) : tool === 'fit' ? (
        <FitTool parts={parts} />
      ) : (
        <CatalogContent>
          {(catalog) => <DreamBuild catalog={catalog} parts={parts} />}
        </CatalogContent>
      )}
    </PageFrame>
  );
}
function Numeric({
  label,
  value,
  set,
  min = 1,
  max = 9999,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step="any"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function GearTool() {
  const [front, setFront] = useState('50'),
    [rear, setRear] = useState('11'),
    [circ, setCirc] = useState('2130'),
    [cadence, setCadence] = useState('90');
  const [cassette, setCassette] = useState('11,12,13,14,15,17,19,21,24,27,30,34');
  const valid =
    Number.isInteger(+front) &&
    Number.isInteger(+rear) &&
    Number(front) >= 20 &&
    Number(front) <= 70 &&
    Number(rear) >= 8 &&
    Number(rear) <= 60 &&
    Number(circ) >= 1000 &&
    Number(circ) <= 3000 &&
    Number(cadence) >= 0 &&
    Number(cadence) <= 220 &&
    cadence !== '';
  const result = valid ? gear(+front, +rear, +circ, +cadence) : null;
  const teeth = cassette
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(Number);
  const validCassette =
    teeth.length >= 1 &&
    teeth.length <= 15 &&
    teeth.every((n) => Number.isInteger(n) && n >= 8 && n <= 60) &&
    new Set(teeth).size === teeth.length;
  return (
    <div className="tool-layout">
      <section className="work-panel">
        <span className="eyebrow">GEAR CALCULATOR</span>
        <h2>同样的踏频，能跑多快？</h2>
        <p>
          改变牙盘和飞轮，看到每踩一圈的前进距离。示例轮周是输入假设，可用车轮滚一圈的实测距离替换。
        </p>
        <div className="form-pair">
          <Numeric label="牙盘齿数 / T" value={front} set={setFront} min={20} max={70} />
          <Numeric label="当前飞轮齿数 / T" value={rear} set={setRear} min={8} max={60} />
          <Numeric label="轮周 / mm" value={circ} set={setCirc} min={1000} max={3000} />
          <Numeric label="踏频 / rpm" value={cadence} set={setCadence} min={0} max={220} />
        </div>
        <div className="work-actions">
          {[
            ['50', '34', '紧凑盘爬坡'],
            ['52', '11', '52T 巡航'],
            ['40', '44', '单盘低齿比'],
          ].map(([f, r, label]) => (
            <button
              key={label}
              className="light-button"
              onClick={() => {
                setFront(f);
                setRear(r);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          飞轮每片齿数（逗号分隔）
          <input value={cassette} maxLength={100} onChange={(e) => setCassette(e.target.value)} />
        </label>
        <p className="work-note">自由组合用于计算，不代表后拨容量、链条长度或牙盘飞轮已经适配。</p>
      </section>
      <section className="work-panel dark-panel">
        <span className="eyebrow">ONE REVOLUTION</span>
        {result ? (
          <>
            <div className="gear-speed">
              {result.speed.toFixed(1)}
              <span>km/h</span>
            </div>
            <div className="metric-row">
              <div>
                <strong>{result.ratio.toFixed(3)}</strong>
                <span>齿比</span>
              </div>
              <div>
                <strong>{result.development.toFixed(2)} m</strong>
                <span>每圈前进距离</span>
              </div>
            </div>
            <p>速度 = 牙盘 ÷ 飞轮 × 轮周 × 踏频。忽略轮胎滑移；这不是功率或坡速预测。</p>
          </>
        ) : (
          <p role="status">请在标示范围内填写完整数值。</p>
        )}
        {validCassette && valid ? (
          <div className="gear-chart">
            {teeth.map((t) => {
              const g = gear(+front, t, +circ, +cadence)!;
              return (
                <button
                  key={t}
                  aria-pressed={rear === String(t)}
                  onClick={() => setRear(String(t))}
                >
                  <span>{t}T</span>
                  <i
                    style={{
                      width: `${(g.speed / Math.max(...teeth.map((x) => gear(+front, x, +circ, +cadence)!.speed), 1)) * 65}%`,
                    }}
                  />
                  <b>{g.speed.toFixed(1)}</b>
                </button>
              );
            })}
          </div>
        ) : (
          <p>飞轮列表需为 1–15 个不重复的整数齿数（8–60 T）。</p>
        )}
      </section>
    </div>
  );
}
function FitTool({ parts }: { parts: PartsCatalog }) {
  const [wheel, setWheel] = useState('zipp-303-firecrest'),
    [tire, setTire] = useState('gp5000-str'),
    [width, setWidth] = useState('28');
  const result = fitCheck(wheel, tire),
    metadata = wheelFit[wheel];
  const w = parts.products.find((p) => p.id === wheel)!,
    t = parts.products.find((p) => p.id === tire)!;
  return (
    <div className="tool-layout">
      <section className="work-panel">
        <span className="eyebrow">TIRE & RIM / 先核对，再装配</span>
        <h2>胎圈与轮圈，要说同一种语言。</h2>
        <label>
          轮组
          <select value={wheel} onChange={(e) => setWheel(e.target.value)}>
            {parts.products
              .filter((p) => p.category === 'wheels')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          轮胎
          <select value={tire} onChange={(e) => setTire(e.target.value)}>
            {parts.products
              .filter((p) => p.category === 'tires')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <Numeric
          label="计划购买的标称胎宽 / mm（核对用）"
          value={width}
          set={setWidth}
          min={23}
          max={65}
        />
        <p className="work-note">
          胎宽由你填写，不表示所选型号一定提供这一规格。此工具识别部分明确冲突，不替代两家厂商的兼容清单。
        </p>
        <a className="text-link" href={`${base}?view=workshop&tool=structures&study=rim`}>
          到结构观察室看胎圈截面 →
        </a>
      </section>
      <section className="work-panel">
        <div className={`fit-result ${result.level}`} role="status">
          <strong>{result.title}</strong>
          <p>{result.text}</p>
        </div>
        <dl className="fit-specs">
          <div>
            <dt>轮圈</dt>
            <dd>
              622 mm 胎圈座直径 · {metadata.inner} mm 内宽 · {metadata.hookless ? '无钩' : '有钩'}
            </dd>
          </div>
          <div>
            <dt>待核对胎宽</dt>
            <dd>{width || '未填写'} mm 标称值；不是充气后的实测宽度</dd>
          </div>
          <div>
            <dt>轮组塔基版本</dt>
            <dd>{metadata.freehubs.join(' / ')}，购买时确认具体版本</dd>
          </div>
        </dl>
        <ol className="fit-checklist">
          <li>在轮组与轮胎的官方资料中，找到完全相同的型号、胎宽和胎圈座直径。</li>
          <li>核对是否允许有内胎 / 无内胎使用、轮圈内宽和压力范围；遵守适用于该组合的较低上限。</li>
          <li>核对前后轴、碟片和塔基接口；装好充气后，再实测车架与前叉间隙。</li>
        </ol>
        <div className="work-actions">
          <a className="light-button" href={w.source} target="_blank" rel="noreferrer">
            轮组官方资料 ↗
          </a>
          <a className="light-button" href={t.source} target="_blank" rel="noreferrer">
            轮胎官方资料 ↗
          </a>
        </div>
        <p className="work-note">图鉴记录的轮胎说明：{t.compatibility}</p>
        {tire === 'aero111' && (
          <p className="fit-result review">
            AERO 111 为前轮用途；后轮请另选轮胎，不能直接按前后一对配置。
          </p>
        )}
      </section>
    </div>
  );
}
function UpgradeTool() {
  const [before, setBefore] = useState('1800'),
    [after, setAfter] = useState('1400'),
    [cost, setCost] = useState('6000');
  const [scope, setScope] = useState('前后轮组，不含轮胎、碟片与飞轮');
  const result = upgrade(amount(before), amount(after), amount(cost));
  return (
    <div className="tool-layout">
      <section className="work-panel">
        <span className="eyebrow">BEFORE / AFTER</span>
        <h2>这一次升级，具体改变了什么？</h2>
        <p>先让两次称重包含同样的东西，再谈减重。预填数字仅为计算示例。</p>
        <label>
          比较范围
          <input value={scope} maxLength={150} onChange={(e) => setScope(e.target.value)} />
        </label>
        <div className="form-pair">
          <Numeric label="升级前 / g" min={0} max={10000000} value={before} set={setBefore} />
          <Numeric label="升级后 / g" min={0} max={10000000} value={after} set={setAfter} />
        </div>
        <Numeric
          label="净支出 / ¥（购买价减旧件回收）"
          min={0}
          max={10000000}
          value={cost}
          set={setCost}
        />
        <p className="work-note">整车方案 A / B 对照可在“梦幻装车单”里记录快照后修改配件。</p>
      </section>
      <section className="work-panel dark-panel">
        <span className="eyebrow">{scope || '同范围对比'}</span>
        {result ? (
          <>
            <div className="gear-speed">
              {Math.abs(result.saved).toFixed(0)}
              <span>g {result.saved >= 0 ? '减轻' : '增加'}</span>
            </div>
            <div className="metric-row">
              <div>
                <strong>
                  {result.percent === null ? '—' : `${Math.abs(result.percent).toFixed(1)}%`}
                </strong>
                <span>相对原重量{result.saved >= 0 ? '减少' : '增加'}</span>
              </div>
              <div>
                <strong>
                  {result.yuanPerGram === null ? '—' : `¥${result.yuanPerGram.toFixed(2)}`}
                </strong>
                <span>每减轻一克的净支出</span>
              </div>
            </div>
            <p>
              仅比较重量与净支出。气动、制动、侧风表现和耐用性需要各自的证据，不能由“每克多少钱”判断升级价值。
            </p>
          </>
        ) : (
          <p role="status">请填写有效的升级前后重量；空白不等于零。</p>
        )}
      </section>
    </div>
  );
}
