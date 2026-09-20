import { useState } from 'react';
import { base } from './SiteChrome';
import {
  interfaceFields,
  checkInterfaces,
  emptyInterfaces,
  parseInterfaces,
  interfaceReport,
  statusLabels,
  sources,
  type InterfaceKey,
  type InterfaceState,
} from './interfaces';
import './community.css';
const storage = 'velodex.interfaces.v1';
const groups: [string, string, InterfaceKey[]][] = [
  ['01', '五通与曲柄', ['frameBB', 'bbShell', 'crank', 'bbCrank']],
  ['02', '轮轴与端盖', ['forkAxle', 'frontHub', 'frameAxle', 'rearHub']],
  ['03', '塔基与飞轮', ['freehub', 'cassette']],
  ['04', '碟片固定接口', ['hubRotor', 'rotor']],
];
const groupResults: Record<string, string[]> = {
  '01': ['shell', 'crank'],
  '02': ['front', 'rear'],
  '03': ['cassette'],
  '04': ['rotor'],
};
export default function InterfaceTool() {
  const [initial] = useState(() => {
    try {
      const hash = new URLSearchParams(location.hash.slice(1)).get('check'),
        raw = hash || localStorage.getItem(storage);
      if (raw && raw.length > 5000) throw new Error();
      return {
        state: raw ? parseInterfaces(JSON.parse(raw)) : emptyInterfaces(),
        notice: hash ? '已打开分享的接口条件；点击保存后才会更新本机进度。' : '',
      };
    } catch {
      return {
        state: emptyInterfaces(),
        notice: '保存记录或分享链接无法读取，已打开空白表单；本机记录未覆盖。',
      };
    }
  });
  const [message, setMessage] = useState(initial.notice),
    [output, setOutput] = useState('');
  const [state, setState] = useState<InterfaceState>(initial.state);
  const results = checkInterfaces(state),
    known = results.filter((r) => r.status !== 'unknown').length,
    blocked = results.filter((r) => r.status === 'blocked').length;
  const update = (key: InterfaceKey, value: string) => {
    setState((s) => ({ ...s, [key]: value }));
    setOutput('');
    setMessage('');
  };
  const copy = async (share: boolean) => {
    const text = share
      ? `${location.origin}${base}?view=workshop&tool=interfaces#check=${encodeURIComponent(JSON.stringify(state))}`
      : interfaceReport(state);
    setOutput(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage(
        share ? '核对链接已复制，打开可恢复所选接口。' : '核对记录已复制，可带给车店逐项确认。',
      );
    } catch {
      setMessage('自动复制未成功，请手动复制下方内容。');
    }
  };
  return (
    <>
      <header className="interface-heading">
        <span className="eyebrow">FIT TOGETHER / 从接口开始</span>
        <h2>装得上，也要问清为什么。</h2>
        <p>
          拿出产品规格，分别选择两侧接口。不确定的项目可以留空；先发现明确冲突，再追查需要垫圈、适配器或具体料号的地方。
        </p>
      </header>
      <div className="interface-layout">
        <div>
          {groups.map(([num, title, keys]) => (
            <section className="work-panel interface-group" key={num}>
              <span className="eyebrow">{num} / INTERFACE</span>
              <h3>{title}</h3>
              <div className="interface-selects">
                {keys.map((key) => (
                  <label key={key}>
                    {interfaceFields[key].label}
                    <select value={state[key]} onChange={(e) => update(key, e.target.value)}>
                      <option value="">不确定 / 其他规格</option>
                      {interfaceFields[key].options.map(([v, t]) => (
                        <option value={v} key={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {num === '01' && (
                <p className="work-note">
                  中轴的两面分别连接车架和曲柄。这里请按包装 / 手册选具体版本，不从品牌名称猜接口。
                </p>
              )}
              {num === '02' && (
                <p className="work-note">
                  请填写花鼓当前安装的端盖规格。可转换版本应先在厂商支持页找到对应套件。
                </p>
              )}
              <div className="interface-quick-results" aria-live="polite">
                {results
                  .filter((r) => groupResults[num].includes(r.id))
                  .map((r) => (
                    <button
                      key={r.id}
                      className={r.status}
                      onClick={() =>
                        document
                          .getElementById(`interface-${r.id}`)
                          ?.scrollIntoView({ block: 'start' })
                      }
                    >
                      {r.title}：{statusLabels[r.status]} →
                    </button>
                  ))}
              </div>
            </section>
          ))}
          <section className="work-panel">
            <h3>接下来，还要核对这些。</h3>
            <p>
              车架 /
              前叉夹器安装座、碟片直径与厚度、油管与接头、链线及后拨容量、电变协议、把组与碗组、座管，以及车架轮胎间隙。
            </p>
            <a className="text-link" href={`${base}?view=workshop&tool=fit`}>
              继续核对轮胎与轮圈 →
            </a>
          </section>
        </div>
        <aside className="interface-results">
          <div className="interface-summary">
            <span className="eyebrow">CHECKLIST / 核对进度</span>
            <h3>
              {known} / {results.length} 项已有结果
            </h3>
            <p>
              {blocked
                ? `${blocked} 处当前配置不能直接装，请先处理这些冲突。`
                : '逐项阅读结果与附加条件；没有发现冲突不等于整车已通过装配检查。'}
            </p>
          </div>
          {results.map((r) => (
            <article key={r.id} id={`interface-${r.id}`} className={`interface-result ${r.status}`}>
              <div>
                <h4>{r.title}</h4>
                <span>{statusLabels[r.status]}</span>
              </div>
              <p>{r.text}</p>
              <small>{r.next}</small>
              <div className="interface-sources">
                {r.source.map((k) => (
                  <a key={k} href={sources[k].url} target="_blank" rel="noreferrer">
                    {sources[k].name} ↗
                  </a>
                ))}
              </div>
            </article>
          ))}
          <div className="work-actions">
            <button
              className="light-button"
              onClick={() => {
                try {
                  localStorage.setItem(storage, JSON.stringify(state));
                  setMessage('核对进度已保存到本机。');
                } catch {
                  setMessage('保存失败，请复制核对链接留存。');
                }
              }}
            >
              保存进度
            </button>
            <button className="light-button" onClick={() => copy(false)}>
              复制核对记录
            </button>
            <button className="dark-button" onClick={() => copy(true)}>
              分享核对链接
            </button>
            <button
              className="quiet-action"
              onClick={() => {
                setState(emptyInterfaces());
                setOutput('');
                setMessage('已清空当前表单；本机保存记录未改动。');
              }}
            >
              清空当前表单
            </button>
          </div>
          <p role="status" className="work-status">
            {message}
          </p>
          {output && (
            <label>
              可复制内容
              <textarea readOnly rows={5} value={output} onFocus={(e) => e.target.select()} />
            </label>
          )}
          <p className="work-note">
            规则核对：2026-09-20。结果限定于所选接口和所列来源；未知规格保留为未确定。
          </p>
        </aside>
      </div>
    </>
  );
}
