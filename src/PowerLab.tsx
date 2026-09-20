import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Download, FileUp, LockKeyhole } from 'lucide-react';
import { base } from './SiteChrome';
import {
  analyzeRide,
  defaultRideSettings,
  demoRide,
  MAX_RIDE_BYTES,
  parseRideXML,
  validRideSettings,
  type Ride,
  type RideSettings,
  type RideInterval,
} from './ride';
import './power.css';

const fields: {
  key: Exclude<keyof RideSettings, 'flat'>;
  label: string;
  min: number;
  max: number;
  step: number;
  note?: string;
}[] = [
  { key: 'rider', label: '骑手体重 / kg', min: 20, max: 250, step: 0.1 },
  { key: 'bike', label: '完整自行车 / kg', min: 3, max: 50, step: 0.1 },
  {
    key: 'cargo',
    label: '额外携带物 / kg',
    min: 0,
    max: 50,
    step: 0.1,
    note: '衣物、鞋盔、水与行李；不重复计入整车部件。',
  },
  {
    key: 'cda',
    label: '整体 CdA / m²',
    min: 0.1,
    max: 1,
    step: 0.01,
    note: '包含骑手姿态和整车；默认 0.32 仅为示例假设。',
  },
  {
    key: 'crr',
    label: '滚阻系数 Crr',
    min: 0.001,
    max: 0.03,
    step: 0.001,
    note: '轮胎、胎压与路面共同影响；默认 0.005 为假设。',
  },
  { key: 'rho', label: '空气密度 / kg/m³', min: 0.7, max: 1.5, step: 0.01 },
  { key: 'efficiency', label: '传动效率 / 0–1', min: 0.8, max: 1, step: 0.01 },
  {
    key: 'wind',
    label: '全程等效迎风 / m/s',
    min: -20,
    max: 20,
    step: 0.5,
    note: '正值迎风，负值顺风；不代表沿路线变化的真实天气。',
  },
];
const fmt = (n: number | undefined, decimals = 0) => (n == null ? '—' : n.toFixed(decimals));
const minutes = (seconds: number) =>
  `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`;
function downloadCSV(rows: RideInterval[], settings: RideSettings) {
  const start = rows[0].start;
  const csv = [
    'elapsed_start_s,duration_s,recorded_power_w,estimated_power_w,speed_kmh,distance_m,rider_kg,bike_kg,cargo_kg,cda_m2,crr,rho_kgm3,efficiency,headwind_ms,flat_assumption',
    ...rows.map((r) =>
      [
        r.start - start,
        r.end - r.start,
        r.measured,
        r.estimated,
        r.speed == null ? undefined : r.speed * 3.6,
        r.distance,
        settings.rider,
        settings.bike,
        settings.cargo,
        settings.cda,
        settings.crr,
        settings.rho,
        settings.efficiency,
        settings.wind,
        settings.flat ? 1 : 0,
      ]
        .map((v) => (v == null ? '' : v.toFixed(3)))
        .join(','),
    ),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'velodex-power-analysis.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return csv;
}
export default function PowerLab() {
  const [ride, setRide] = useState<Ride>();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [xml, setXML] = useState('');
  const [csv, setCSV] = useState('');
  const [ftp, setFTP] = useState('');
  const [testConfirmed, setTestConfirmed] = useState(false);
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      Object.entries(defaultRideSettings)
        .filter(([k]) => k !== 'flat')
        .map(([k, v]) => [k, String(v)]),
    ),
  );
  const [flat, setFlat] = useState(false);
  useEffect(() => {
    setCSV('');
  }, [ride, values, flat]);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const settings = {
    ...Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)]),
    ),
    flat,
  } as RideSettings;
  const valid = validRideSettings(settings);
  const analysis = useMemo(() => {
    if (!ride || !valid) return undefined;
    try {
      return { result: analyzeRide(ride, settings), error: '' };
    } catch (e) {
      return { result: undefined, error: (e as Error).message };
    }
  }, [ride, valid, JSON.stringify(settings)]);
  const result = analysis?.result;
  const accept = (text: string, label: string) => {
    try {
      const parsed = parseRideXML(text);
      setRide(parsed);
      setName(label);
      setError('');
      setTestConfirmed(false);
      setFlat(false);
    } catch (e) {
      setRide(undefined);
      setName('');
      setError((e as Error).message);
    }
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    const id = ++request.current;
    setBusy(true);
    setError('');
    setRide(undefined);
    setName('');
    try {
      if (file.size > MAX_RIDE_BYTES) throw new Error('文件超过 10 MB，请导出较短的单次骑行。');
      const text = await file.text();
      if (id === request.current) accept(text, file.name);
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  };
  const average = result?.measured.average;
  const validFTP = ftp.trim() !== '' && Number.isFinite(+ftp) && +ftp > 0 && +ftp <= 1000;
  return (
    <div className="power-lab">
      <header className="power-heading">
        <span className="eyebrow">POWER / UNDERSTAND THE EFFORT</span>
        <h2>每一瓦，从哪里来？</h2>
        <p>读懂功率，再把一次骑行放进模型里。文件功率记录与物理估算分别展示。</p>
      </header>
      <div className="power-knowledge">
        <article>
          <span>01 / WATTS</span>
          <h3>功率不是速度</h3>
          <p>
            功率是做功的速率，单位
            W。相同功率下，坡度、风、姿态和跟骑都会改变速度。平均功率按时间加权，零功率滑行也应计入；缺失记录不等于零。
          </p>
        </article>
        <article>
          <span>02 / W·KG⁻¹</span>
          <h3>功体比，先说明分母</h3>
          <p>
            通常指功率 ÷ 骑手体重。例如 250 W / 70 kg ≈ 3.57
            W/kg。爬坡模型还需计入车和行李；平路高速表现也受绝对功率与 CdA 影响。
          </p>
        </article>
        <article>
          <span>03 / FTP</span>
          <h3>阈值是训练参考</h3>
          <p>
            FTP 是功能性阈值功率，用于描述持续输出能力和设定训练强度。规范 20 分钟测试均值 × 0.95
            是常见估算方法，但个体和测试方案会影响结果；日常骑行均值不等于 FTP。
          </p>
          <a
            href="https://help.trainingpeaks.com/hc/en-us/articles/204071934-How-to-Calculate-Threshold-Values-for-Power-Heart-Rate-or-Pace"
            target="_blank"
            rel="noreferrer"
          >
            TrainingPeaks · 阈值说明 <ArrowUpRight size={12} />
          </a>
        </article>
      </div>
      <div className="power-upload work-panel">
        <div>
          <FileUp size={25} />
          <h3>带来一次骑行。</h3>
          <p>
            GPX / TCX · 最大 10 MB · 100,000
            点。需要时间戳；路线文件常常没有时间。支持常见功率扩展、海拔、坐标与 TCX 距离记录。
          </p>
          <div className="power-upload-actions">
            <label className="dark-button">
              选择骑行文件
              <input
                ref={input}
                type="file"
                accept=".gpx,.tcx,.xml"
                aria-label="选择 GPX 或 TCX 骑行文件"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
            </label>
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => {
                request.current++;
                setRide(demoRide());
                setName('30 分钟模拟骑行');
                setError('');
                setTestConfirmed(false);
                setFlat(false);
              }}
            >
              先看模拟示例
            </button>
            {ride && (
              <button
                className="text-link"
                onClick={() => {
                  request.current++;
                  setRide(undefined);
                  setName('');
                  setXML('');
                  setError('');
                  setTestConfirmed(false);
                  if (input.current) input.current.value = '';
                }}
              >
                清除本次数据
              </button>
            )}
          </div>
        </div>
        <p className="power-private">
          <LockKeyhole size={16} /> 文件仅在当前浏览器内存中处理，不上传、不保存轨迹。导出的 CSV
          不含经纬度。
        </p>
        <details className="power-paste">
          <summary>或粘贴 GPX / TCX 文本</summary>
          <textarea
            aria-label="GPX 或 TCX XML 文本"
            value={xml}
            maxLength={MAX_RIDE_BYTES}
            onChange={(e) => setXML(e.target.value)}
            placeholder="粘贴完整 XML 内容"
          />
          <button
            className="outline-button"
            disabled={busy || !xml.trim()}
            onClick={() => accept(xml, '粘贴的骑行记录')}
          >
            读取文本
          </button>
        </details>
        {busy && <p role="status">正在读取本地文件…</p>}
        {error && (
          <p className="power-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="power-analysis-layout">
        <section className="work-panel power-inputs">
          <span className="eyebrow">MODEL ASSUMPTIONS</span>
          <h3>把假设写在前面。</h3>
          <p>
            整车重量已含随车部件。若手头只有分件重量，可先用
            <a href={`${base}?view=workshop&tool=build`}>装车单</a>汇总。未核实的默认值都是示例。
          </p>
          <div className="power-fields">
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
                {f.note && <small>{f.note}</small>}
              </label>
            ))}
          </div>
          <label className="power-check">
            <input type="checkbox" checked={flat} onChange={(e) => setFlat(e.target.checked)} />{' '}
            将全程视为平路（忽略海拔）
          </label>
          <p className="power-small">只有明确接受平路假设时才勾选。缺失海拔的区间默认不估算。</p>
          <label className="power-ftp">
            已知 FTP / W（选填）
            <input
              type="number"
              min="1"
              max="1000"
              value={ftp}
              placeholder="例如 250"
              onChange={(e) => setFTP(e.target.value)}
            />
          </label>
          {ftp && !validFTP && <p className="power-error">FTP 请填写 1–1000 W。</p>}
          {!valid && (
            <p role="alert" className="power-error">
              有输入超出范围或为空，请检查各字段。
            </p>
          )}
        </section>
        <section className="work-panel power-results" aria-live="polite">
          <span className="eyebrow">THE RIDE REPORT</span>
          <h3>{name || '先读入记录，再看结果。'}</h3>
          {analysis?.error && (
            <p role="alert" className="power-error">
              {analysis.error}
            </p>
          )}
          {!ride && (
            <p>
              如果文件包含功率记录，这里会优先展示记录值。估算曲线用于理解重量、坡度和风阻的影响，不能替代功率计测量。
            </p>
          )}
          {result && ride && (
            <>
              <p className="power-small">
                {ride.format} · {ride.points.length.toLocaleString()} 个带时间点 · 有效连续区间{' '}
                {minutes(result.duration)}。轨迹分段、重复时间和超过 30 秒的缺口不拼接。
              </p>
              <div className="power-metrics">
                <div>
                  <small>文件功率 · 时间加权</small>
                  <strong>
                    {fmt(average)}
                    <span> W</span>
                  </strong>
                  <p>
                    覆盖 {fmt((100 * result.measured.seconds) / result.duration)}% ·
                    含记录中的零功率
                  </p>
                </div>
                <div className="estimated">
                  <small>模型估算 · 时间加权</small>
                  <strong>
                    {fmt(result.estimated.average)}
                    <span> W</span>
                  </strong>
                  <p>
                    覆盖 {fmt((100 * result.estimated.seconds) / result.duration)}% ·{' '}
                    {flat ? '全程平路假设' : '使用平滑海拔'}
                  </p>
                  {result.estimated.average != null && (
                    <p>
                      估算均值 / 骑手体重：{fmt(result.estimated.average / settings.rider, 2)} W/kg
                    </p>
                  )}
                </div>
                <div>
                  <small>记录均值 / 骑手体重</small>
                  <strong>
                    {fmt(average == null ? undefined : average / settings.rider, 2)}
                    <span> W/kg</span>
                  </strong>
                  <p>分母 {settings.rider} kg；这是本次记录均值</p>
                </div>
                <div>
                  <small>最佳连续 20 分钟 · 文件记录</small>
                  <strong>
                    {fmt(result.best20)}
                    <span> W</span>
                  </strong>
                  <p>无完整 20 分钟功率记录时留空</p>
                </div>
              </div>
              <div className="power-summary">
                <span>
                  有效距离{' '}
                  {result.distanceSeconds ? `${fmt(result.distance / 1000, 2)} km` : '未提供'}（覆盖{' '}
                  {fmt((100 * result.distanceSeconds) / result.duration)}%）
                </span>
                <span>
                  平滑累计上升 {result.altitudeSeconds ? `${fmt(result.climbing)} m` : '未提供'}
                  （海拔覆盖 {fmt((100 * result.altitudeSeconds) / result.duration)}%）
                </span>
                <span>
                  记录功率机械功{' '}
                  {result.measured.seconds ? `${fmt(result.measured.joules / 1000)} kJ` : '未提供'}{' '}
                  · 不是代谢热量
                </span>
              </div>
              {result.measured.average == null && (
                <p className="power-notice">
                  文件没有可统计的功率记录。可在数据齐全时进行模型估算，不能据此推算 FTP。
                </p>
              )}
              {result.estimated.average == null && (
                <p className="power-notice">
                  估算需要有效速度和海拔。可检查源文件；仅在路线确为平路且接受简化时，使用左侧平路假设。
                </p>
              )}
              <PowerChart rows={result.intervals} />
              {result.low != null && (
                <p className="power-small">
                  敏感性示例：仅把 CdA 改为当前值的 80% / 120%，估算均值为 {fmt(result.low)}–
                  {fmt(result.high)} W。这不是误差范围或置信区间；未知风况可能带来更大偏差。
                </p>
              )}
              {validFTP && (
                <p className="power-notice">
                  所填 FTP：{+ftp} W · {fmt(+ftp / settings.rider, 2)} W/kg。
                  {average != null &&
                    `本次记录均值约为 FTP 的 ${fmt((average / +ftp) * 100)}%。此比例不是 IF，未计算 NP / TSS。`}
                </p>
              )}
              {result.best20 != null && !ride.format.startsWith('模拟') && (
                <div className="ftp-estimate">
                  <label className="power-check">
                    <input
                      type="checkbox"
                      checked={testConfirmed}
                      onChange={(e) => setTestConfirmed(e.target.checked)}
                    />{' '}
                    我确认这次记录包含规范的 20 分钟全力测试，且文件功率来自功率计。
                  </label>
                  {testConfirmed && (
                    <p>
                      FTP 经验估算：
                      <strong>
                        {fmt(result.best20 * 0.95)} W /{' '}
                        {fmt((result.best20 * 0.95) / settings.rider, 2)} W/kg
                      </strong>
                      。采用最佳 20 分钟 × 0.95；需结合所用测试方案判断。
                    </p>
                  )}
                </div>
              )}
              {(ride.discarded > 0 || result.skipped > 0) && (
                <p className="power-small">
                  跳过 {ride.discarded} 个无效或不递增时间点；{result.skipped}{' '}
                  个异常速度区间不参与距离和模型估算，保留其中有效的功率记录。
                </p>
              )}
              <button
                className="outline-button"
                onClick={() => setCSV(downloadCSV(result.intervals, settings))}
              >
                <Download size={15} /> 导出功率明细 CSV
              </button>
              {csv && (
                <div className="power-csv">
                  <p role="status">
                    已生成 CSV 并发起下载，包含本次模型参数。若浏览器未保存文件，也可复制下方文本。
                  </p>
                  <textarea
                    aria-label="功率明细 CSV 文本"
                    readOnly
                    value={csv}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <details className="power-method">
        <summary>计算方法、数据缺口与适用边界</summary>
        <p>
          功率模型：P = max(0, [½ρCdA(v+w)|v+w| + mg·sinθ + Crr·mg·cosθ + ma]·v / η)。m
          为人、整车与携带物总质量，v 为地速，w 为沿行进方向的等效迎风，η 为传动效率。负需求截为
          0，不作能量回收。
        </p>
        <p>
          优先使用 TCX 距离差，否则用 GPS 坐标距离，再尝试速度记录。连续片段内对海拔和速度作约 30
          秒窗口平均，再求坡度和加速度；这会削弱短促冲刺和陡坡。平均记录功率使用相邻样本的梯形积分，缺失值不填零，最佳
          20 分钟不能跨缺口。
        </p>
        <p>
          文件中的功率字段可能由上游平台估算，本工具不能自动证明它来自传感器。GPS
          海拔噪声、定位漂移、刹车、侧风、跟骑、姿态变化和转动惯量未被完整建模；未知条件下，不用于判断某个配件的真实节省瓦数。
        </p>
        <p>
          来源：
          <a
            href="https://www.gribble.org/cycling/power_v_speed.html"
            target="_blank"
            rel="noreferrer"
          >
            Steve Gribble · 骑行阻力模型
          </a>
          ；
          <a
            href="https://www.trainingpeaks.com/blog/the-physiology-of-ftp-and-new-testing-protocols/"
            target="_blank"
            rel="noreferrer"
          >
            TrainingPeaks · FTP 测试与差异
          </a>
          。
        </p>
      </details>
    </div>
  );
}
function PowerChart({ rows }: { rows: RideInterval[] }) {
  const [mode, setMode] = useState<'both' | 'measured' | 'estimated'>('both');
  const available = rows.filter((r) => r.measured != null || r.estimated != null);
  if (!available.length) return null;
  const from = rows[0].start,
    to = rows.at(-1)!.end;
  const max = rows.reduce((m, r) => Math.max(m, r.measured ?? 0, r.estimated ?? 0), 100) * 1.08;
  const step = Math.max(1, Math.ceil(rows.length / 500));
  const path = (key: 'measured' | 'estimated') => {
    let d = '',
      last: RideInterval | undefined;
    for (let i = 0; i < rows.length; i += step) {
      const r = rows[i];
      const window = rows.slice(i, Math.min(i + step, rows.length));
      const valid = window.filter((p) => p[key] != null);
      if (!valid.length) {
        last = undefined;
        continue;
      }
      const value =
        valid.reduce((n, p) => n + p[key]! * (p.end - p.start), 0) /
        valid.reduce((n, p) => n + p.end - p.start, 0);
      d += `${!last || last.segment !== r.segment || r.start - last.end > 30 ? 'M' : 'L'}${(48 + ((r.end - from) / (to - from)) * 700).toFixed(1)},${(228 - (value / max) * 195).toFixed(1)} `;
      last = window.at(-1);
    }
    return d;
  };
  return (
    <div className="power-chart">
      <div>
        <span>功率随时间</span>
        <label className="sr-only" htmlFor="power-chart-mode">
          显示功率曲线
        </label>
        <select
          id="power-chart-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="both">记录与估算</option>
          <option value="measured">仅文件记录</option>
          <option value="estimated">仅模型估算</option>
        </select>
      </div>
      <svg
        viewBox="0 0 780 275"
        role="img"
        aria-label="功率时间曲线。实线为文件功率，虚线为模型估算。"
      >
        <path d="M48 30V228H748" stroke="#b5c3a7" fill="none" />
        {[0, 0.5, 1].map((n) => (
          <g key={n}>
            <path d={`M48 ${228 - n * 195}H748`} stroke="#dce4d4" />
            <text x="39" y={232 - n * 195} textAnchor="end">
              {Math.round(max * n)}
            </text>
          </g>
        ))}
        {mode !== 'estimated' && (
          <path d={path('measured')} fill="none" stroke="#385c39" strokeWidth="2" />
        )}
        {mode !== 'measured' && (
          <path
            d={path('estimated')}
            fill="none"
            stroke="#b66c35"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        )}
        <text x="48" y="254">
          0 分
        </text>
        <text x="748" y="254" textAnchor="end">
          {fmt((to - from) / 60, 1)} 分
        </text>
        <text x="15" y="18">
          W
        </text>
      </svg>
      <p>绿色实线 / 文件功率　橙色虚线 / 模型估算。长记录按时间段聚合显示。</p>
    </div>
  );
}
