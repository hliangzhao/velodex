import { useEffect, useMemo, useState } from 'react';
import { Download, Save } from 'lucide-react';
import type { Ride } from './ride';
import {
  historyKey,
  parseTrainingHistory,
  rideFingerprint,
  trainingAnalysis,
  trainingSources,
  validFTP,
  workout,
  workoutText,
  type TrainingEntry,
  type WorkoutGoal,
} from './training';
async function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const value = (n: number | undefined, digits = 0) => (n == null ? '—' : n.toFixed(digits));
const time = (s: number) => `${(s / 60).toFixed(1)} 分钟`;
const sourceNames = {
  meter: '功率计 / 骑行台',
  unknown: '功率来源未说明',
  estimated: '平台估算功率',
};
function localDate(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export default function TrainingPanel({
  ride,
  name,
  ftp,
  setFTP,
}: {
  ride?: Ride;
  name: string;
  ftp: string;
  setFTP: (s: string) => void;
}) {
  const [source, setSource] = useState<'unknown' | 'meter' | 'estimated'>('unknown');
  const [goal, setGoal] = useState<WorkoutGoal>('endurance'),
    [duration, setDuration] = useState(45),
    [rpe, setRPE] = useState('');
  const [history, setHistory] = useState<TrainingEntry[]>(() => {
    try {
      return parseTrainingHistory(JSON.parse(localStorage.getItem(historyKey) || '[]'));
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState(''),
    [undo, setUndo] = useState<TrainingEntry[] | null>(null),
    [exported, setExported] = useState('');
  useEffect(() => {
    setSource('unknown');
    setRPE('');
    setMessage('');
  }, [ride]);
  const report = useMemo(() => (ride ? trainingAnalysis(ride, +ftp) : undefined), [ride, ftp]);
  const isDemo = !!ride?.format.startsWith('模拟');
  const measured = source === 'meter' || isDemo;
  const ftpOK = ftp.trim() !== '' && validFTP(+ftp);
  const blocks = workout(goal, duration);
  const recent = history.filter((e) => {
    const days = (Date.now() - new Date(e.date + 'T12:00:00').getTime()) / 86400000;
    return days >= -1 && days < 7;
  });
  const writeHistory = (next: TrainingEntry[]) => {
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
      setHistory(next);
      return true;
    } catch {
      setMessage('无法保存，请先导出摘要备份。');
      return false;
    }
  };
  const save = () => {
    if (!ride || !report || isDemo || !rpe || !report.elapsed) return;
    const id = rideFingerprint(ride);
    if (history.some((h) => h.id === id)) {
      setMessage('这份记录已经保存，未重复累计。');
      return;
    }
    if (history.length >= 120) {
      setMessage('已保存 120 次摘要，请先导出并整理旧记录。');
      return;
    }
    const entry: TrainingEntry = {
      id,
      name: name.slice(0, 120),
      date: localDate(ride.points[0].time * 1000),
      minutes: report.elapsed / 60,
      ftp: ftpOK ? +ftp : null,
      mean: report.mean ?? null,
      tss: measured ? (report.tss ?? null) : null,
      rpe: +rpe,
      source,
    };
    if (writeHistory([entry, ...history]))
      setMessage('只保存日期、时长、功率摘要和主观感受，没有保存路线或原始文件。');
  };
  const exportHistory = async () => {
    const text = [
      '我的骑行摘要',
      ...history.map(
        (h) =>
          `${h.date} · ${h.name}\n${h.minutes.toFixed(1)} 分钟 · 文件均值 ${h.mean?.toFixed(0) ?? '未提供'} W · FTP ${h.ftp ?? '未填写'} W · TSS ${h.tss?.toFixed(1) ?? '未计算'} · 主观强度 ${h.rpe}/10 · ${sourceNames[h.source]}`,
      ),
    ].join('\n\n');
    setExported(text);
    try {
      await download(new Blob([text], { type: 'text/plain;charset=utf-8' }), '骑行训练摘要.txt');
      setMessage('摘要已生成，也可复制下方文本。');
    } catch {
      setMessage('可复制下方文本保存。');
    }
  };
  return (
    <div className="training-panel">
      <section className="work-panel training-profile">
        <div>
          <h3>训练基准</h3>
          <p>填写近期测试或已核实的 FTP。没有功率计数据时，仍可记录骑行时长和主观感受。</p>
        </div>
        <label>
          已知 FTP / W
          <input
            type="number"
            min="1"
            max="1000"
            value={ftp}
            placeholder="选填，例如 250"
            onChange={(e) => setFTP(e.target.value)}
          />
        </label>
        {ftp && !ftpOK && <p role="alert">FTP 请填写 1–1000 W；骑行均值不作为 FTP。</p>}
        {ride && !isDemo && (
          <label>
            文件中的功率来自哪里
            <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
              <option value="unknown">不清楚 / 没有功率记录</option>
              <option value="meter">功率计或可测功率的骑行台</option>
              <option value="estimated">平台根据速度等信息估算</option>
            </select>
          </label>
        )}
      </section>
      {!ride && (
        <div className="training-empty">
          <h3>从一次骑行开始</h3>
          <p>
            导入 GPX / TCX，查看数据覆盖、持续功率、分区时间和训练参考。也可以先填写
            FTP，生成一节参考课表。
          </p>
        </div>
      )}
      {report && (
        <section className="work-panel training-report">
          <div className="training-title">
            <h3>{isDemo ? '模拟骑行分析' : '这次骑行说明了什么'}</h3>
            <span>{isDemo ? '仅演示，不进入训练记录' : '本地分析'}</span>
          </div>
          <div className="training-metrics">
            <div>
              <small>文件总时长</small>
              <strong>{time(report.elapsed)}</strong>
            </div>
            <div>
              <small>有效功率覆盖</small>
              <strong>{value(report.coverage * 100)}%</strong>
            </div>
            <div>
              <small>文件平均心率</small>
              <strong>
                {value(report.heartRate)} <em>bpm</em>
              </strong>
              <small>覆盖 {value(report.heartCoverage * 100)}%</small>
            </div>
            <div>
              <small>文件平均踏频</small>
              <strong>
                {value(report.cadence)} <em>rpm</em>
              </strong>
              <small>覆盖 {value(report.cadenceCoverage * 100)}%，包含零踏频</small>
            </div>
          </div>
          <p className="power-small">
            仅分析相邻间隔不超过 5 秒的记录。功率缺失或采样过疏共 {time(report.missing)}
            ，不填零、不跨缺口拼接。
          </p>
          {!measured && (
            <p className="training-notice">
              请先确认功率来源。平台估算功率不用于训练分区、NP、IF 或
              TSS；可以切换到“阻力与功率估算”理解风阻和重量。
            </p>
          )}
          {measured && (
            <>
              <div className="training-metrics">
                <div>
                  <small>文件平均功率</small>
                  <strong>
                    {value(report.mean)} <em>W</em>
                  </strong>
                </div>
                <div>
                  <small>NP 估算</small>
                  <strong>
                    {value(report.np)} <em>W</em>
                  </strong>
                </div>
                <div>
                  <small>强度系数 IF</small>
                  <strong>{value(report.intensity, 2)}</strong>
                </div>
                <div>
                  <small>训练负荷 TSS 估算</small>
                  <strong>{value(report.tss, 1)}</strong>
                </div>
              </div>
              {report.np == null && (
                <p className="power-small">
                  整次 NP / IF / TSS 需要至少 10 分钟完整、连续的功率记录；IF / TSS 还需要有效
                  FTP。当前条件不足时不显示这组数值。
                </p>
              )}
              <h4>连续输出，而不只是瞬时峰值</h4>
              <div className="training-peaks">
                {report.peaks.map((p) => (
                  <div key={p.duration}>
                    <span>{p.duration < 60 ? `${p.duration} 秒` : `${p.duration / 60} 分钟`}</span>
                    <strong>
                      {value(p.watts)} <small>W</small>
                    </strong>
                  </div>
                ))}
              </div>
              <p className="power-small">
                5 秒峰值要求相邻采样间隔不超过 1 秒；其余窗口最多 5
                秒。空白表示没有完整窗口，不代表零功率。这是本次最佳记录，不是能力上限。
              </p>
              {ftpOK && report.seconds > 0 && (
                <>
                  <h4>功率分区时间</h4>
                  <div className="training-zones">
                    {report.zones.map((z, i) => (
                      <div key={z.name}>
                        <span>
                          Z{i + 1} · {z.name}
                          <small>
                            {i === 0
                              ? '≤55%'
                              : i === 5
                                ? '>120%'
                                : `>${[55, 75, 90, 105][i - 1]}–${Math.round(z.upper * 100)}%`}{' '}
                            FTP
                          </small>
                        </span>
                        <div>
                          <i
                            style={{
                              width: `${(z.seconds / report.seconds) * 100}%`,
                              background: `hsl(${125 - i * 23} 35% ${42 + i * 2}%)`,
                            }}
                          />
                        </div>
                        <b>{time(z.seconds)}</b>
                      </div>
                    ))}
                  </div>
                  <p className="power-small">
                    按相邻样本平均功率划分，以有效功率时间为分母。连续边界采用
                    55%、75%、90%、105%、120%；冲刺能力不能仅凭 FTP 比例划分，因此不设固定百分比的
                    Z7。
                  </p>
                </>
              )}
              <div className="training-advice">
                <h4>下一次可以怎么调整</h4>
                {report.coverage < 0.95 && (
                  <p>
                    先改善记录完整度：检查传感器掉线与码表记录模式。当前功率覆盖{' '}
                    {value(report.coverage * 100)}%，不宜用整次负荷判断训练变化。
                  </p>
                )}
                {ftpOK && report.seconds > 0 && (
                  <p>
                    有效记录中{' '}
                    {value(
                      (report.zones.slice(2).reduce((s, z) => s + z.seconds, 0) / report.seconds) *
                        100,
                    )}
                    % 的时间高于 75%
                    FTP。若本来计划做耐力骑，可以在爬坡和跟车时主动降档、控制输出，减少反复提速。
                  </p>
                )}
                {!!rpe && +rpe >= 8 ? (
                  <p>
                    你将本次主观强度标为 {rpe}
                    /10。下一次先看恢复情况，参考课表优先选恢复或轻松耐力。
                  </p>
                ) : (
                  <p>
                    结合主观感受和近期训练安排选择课表。单次最佳功率或一次轻松骑行，不能独立判断 FTP
                    提升或下降。
                  </p>
                )}
                {!ftpOK && (
                  <p>没有 FTP 时先看连续功率和记录质量，不需要为了得到训练负荷而猜一个阈值。</p>
                )}
              </div>
            </>
          )}
          {!isDemo && (
            <div className="training-save">
              <label>
                本次主观强度 / RPE
                <select value={rpe} onChange={(e) => setRPE(e.target.value)}>
                  <option value="">按自己的感受选择</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} / 10
                      {i === 1
                        ? ' · 很轻松'
                        : i === 4
                          ? ' · 有些吃力'
                          : i === 7
                            ? ' · 很吃力'
                            : i === 9
                              ? ' · 全力'
                              : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button className="dark-button" disabled={!rpe || !report.elapsed} onClick={save}>
                <Save size={15} />
                保存本次摘要
              </button>
            </div>
          )}
        </section>
      )}
      <section className="work-panel training-workout">
        <h3>把目标变成一节课</h3>
        <p>
          以下为可调整的参考模板，不从一次骑行自动开出训练处方。没有近期稳定训练习惯，先选恢复或耐力。
        </p>
        <div className="training-controls">
          <label>
            训练目标
            <select value={goal} onChange={(e) => setGoal(e.target.value as WorkoutGoal)}>
              <option value="recovery">恢复转腿</option>
              <option value="endurance">基础耐力</option>
              <option value="tempo">节奏稳定性</option>
              <option value="threshold">阈值附近输出</option>
            </select>
          </label>
          <label>
            可用时间
            <select value={duration} onChange={(e) => setDuration(+e.target.value)}>
              {[30, 45, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n} 分钟
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="training-blocks" aria-label="课表阶段示意">
          {blocks.map((b, i) => (
            <div
              key={i}
              style={{ flex: b.minutes, background: b.high > 0.75 ? '#dce7b5' : '#e8ede2' }}
            >
              <span>{b.minutes}′</span>
            </div>
          ))}
        </div>
        <ol>
          {blocks.map((b, i) => (
            <li key={i}>
              <strong>
                {b.name} · {b.minutes} 分钟
              </strong>
              <span>
                {Math.round(b.low * 100)}–{Math.round(b.high * 100)}% FTP
                {ftpOK ? ` · ${Math.round(b.low * +ftp)}–${Math.round(b.high * +ftp)} W` : ''}
              </span>
            </li>
          ))}
        </ol>
        <p className="power-small">
          强度日之间留出恢复；疲劳未消退时改选轻松骑行。功率只是控制强度的参考，不能替代对身体感受的判断。
        </p>
        <button
          className="outline-button"
          disabled={!ftpOK}
          onClick={async () => {
            const text = workoutText(goal, duration, +ftp);
            setExported(text);
            try {
              await download(
                new Blob([text], { type: 'text/plain;charset=utf-8' }),
                '骑行参考课表.txt',
              );
            } catch {
              setMessage('课表可从下方复制保存。');
            }
          }}
        >
          <Download size={15} />
          导出参考课表
        </button>
      </section>
      <section className="work-panel training-history">
        <h3>我的训练记录</h3>
        <p>
          最近 7 天已保存 {recent.length} 次，共{' '}
          {recent.reduce((s, e) => s + e.minutes, 0).toFixed(0)}{' '}
          分钟。只统计你保存到本机的摘要，不代表完整训练史。
        </p>
        {!history.length && (
          <p className="power-small">导入一次真实骑行并填写主观感受后，即可开始积累记录。</p>
        )}
        <div className="training-history-list">
          {history.map((e) => (
            <article key={e.id}>
              <div>
                <strong>
                  {e.date} · {e.name}
                </strong>
                <span>
                  {e.minutes.toFixed(0)} 分钟 · RPE {e.rpe}/10 · 文件均值{' '}
                  {e.mean?.toFixed(0) ?? '—'} W
                  {e.tss != null ? ` · 估算 TSS ${e.tss.toFixed(1)}` : ''}
                </span>
                <span>{sourceNames[e.source]}</span>
              </div>
              <button
                onClick={() => {
                  if (writeHistory(history.filter((h) => h.id !== e.id))) setUndo(history);
                }}
              >
                移除
              </button>
            </article>
          ))}
        </div>
        {undo && (
          <button
            onClick={() => {
              if (writeHistory(undo)) setUndo(null);
            }}
          >
            撤销移除
          </button>
        )}
        {!!history.length && (
          <button className="outline-button" onClick={exportHistory}>
            导出全部摘要
          </button>
        )}
        {message && <p role="status">{message}</p>}
        {exported && (
          <details open>
            <summary>可复制的导出文本</summary>
            <textarea
              aria-label="训练导出文本"
              readOnly
              value={exported}
              onFocus={(e) => e.target.select()}
            />
          </details>
        )}
      </section>
      <details className="power-method">
        <summary>计算口径与资料来源</summary>
        <p>
          NP 使用 30 秒滚动平均的四次方均值再开四次方根，以 1
          秒步长计算。相邻样本均值代表整个采样区间，因此稀疏记录与码表的逐秒结果可能不同。IF = NP /
          FTP；TSS = 时长（小时）× IF² × 100。存在缺口、跨段或不足 10
          分钟时不计算整次负荷；阈值随训练水平变化，这些指标不直接预测恢复时间。
        </p>
        <p>
          来源：
          <a href={trainingSources.zones} target="_blank" rel="noreferrer">
            Coggan 功率分区
          </a>{' '}
          ·{' '}
          <a href={trainingSources.np} target="_blank" rel="noreferrer">
            NP 计算方法
          </a>{' '}
          ·{' '}
          <a href={trainingSources.load} target="_blank" rel="noreferrer">
            TrainingPeaks 负荷说明
          </a>
          。模板由本站按这些强度范围组织，并非来源提供的个体训练计划。
        </p>
      </details>
    </div>
  );
}
