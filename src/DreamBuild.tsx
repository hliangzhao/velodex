import { useEffect, useRef, useState } from 'react';
import { Download, Share2, Save, Check, Link as LinkIcon } from 'lucide-react';
import type { Bike, Catalog, PartsCatalog } from './types';
import { imageUrl } from './catalog';
import { paintsForBike } from './bikePaints';
import { base } from './SiteChrome';
import chinaPrices from './data/china-prices.json';
import { drawPoster, itemName } from './BuildPoster';
import WeightAssistant from './WeightAssistant';
import {
  slots,
  newBuild,
  totals,
  parseBuild,
  encodeBuild,
  decodeBuild,
  defaultWeightVariant,
  weightReferences,
  weightBreakdown,
  fitCheck,
  type DreamBuild as Build,
  type Slot,
  type BuildItem,
} from './workshop';
const key = 'velodex.dream-build.v1';
export default function DreamBuild({ catalog, parts }: { catalog: Catalog; parts: PartsCatalog }) {
  const [message, setMessage] = useState('');
  const [build, setBuild] = useState<Build>(() => newBuild());
  const [ready, setReady] = useState(false);
  const [poster, setPoster] = useState<{ url: string; blob: Blob }>();
  const [working, setWorking] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const request = useRef(0);
  const bike = catalog.bikes.find((b) => b.id === build.bikeId) || catalog.bikes[0];
  const paint = paintsForBike(bike).find((p) => p.id === build.paintId) || paintsForBike(bike)[0];
  const [baseline, setBaseline] = useState<Build>();
  const [cleared, setCleared] = useState<Build>();
  useEffect(() => {
    try {
      const shared = new URLSearchParams(location.hash.slice(1)).get('build');
      const saved = shared ? null : localStorage.getItem(key);
      const candidate = shared
        ? decodeBuild(shared)
        : saved
          ? parseBuild(JSON.parse(saved))
          : newBuild();
      if (!shared) {
        const query = new URLSearchParams(location.search);
        const platform = catalog.bikes.find((b) => b.id === query.get('platform'));
        const part = parts.products.find((p) => p.id === query.get('part'));
        if (platform) {
          candidate.bikeId = platform.id;
          candidate.paintId =
            paintsForBike(platform).find((p) => p.id === query.get('paint'))?.id || 'default';
          candidate.items.frame = newBuild().items.frame;
        }
        if (
          part &&
          (part.category === 'groupsets' ||
            part.category === 'wheels' ||
            part.category === 'tires') &&
          part.id !== 'aero111'
        ) {
          const slot = part.category === 'groupsets' ? 'groupset' : part.category;
          candidate.items[slot] = {
            choice: part.id,
            custom: '',
            grams: '',
            weightMode: 'auto',
            weightVariant: defaultWeightVariant(part.id),
            yuan: '',
            checked: false,
          };
        }
        if (platform || part) setMessage('已从图鉴带入所选项目。点击保存后才会更新本机清单。');
      }
      if (
        !catalog.bikes.some(
          (b) =>
            b.id === candidate.bikeId && paintsForBike(b).some((p) => p.id === candidate.paintId),
        )
      )
        throw new Error('车型或涂装已不在图鉴中');
      for (const [slot] of slots)
        if (
          candidate.items[slot].choice &&
          !parts.products.some(
            (p) =>
              p.id === candidate.items[slot].choice &&
              p.category === (slot === 'groupset' ? 'groupsets' : slot),
          )
        )
          throw new Error('配件已不在图鉴中');
      setBuild(candidate);
      if (shared) setMessage('已打开分享装车单。点击“保存到本机”后才会覆盖本机清单。');
    } catch {
      setMessage('原有清单或分享链接无法读取，已打开空白清单；尚未覆盖本机数据。');
    }
    setReady(true);
  }, [catalog, parts]);
  useEffect(() => {
    request.current++;
    setPoster(undefined);
    setShareLink('');
  }, [build]);
  useEffect(
    () => () => {
      if (poster) URL.revokeObjectURL(poster.url);
    },
    [poster],
  );
  const update = (slot: Slot, patch: Partial<BuildItem>) =>
    setBuild((b) => ({ ...b, items: { ...b.items, [slot]: { ...b.items[slot], ...patch } } }));
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(parseBuild(build)));
      setMessage('装车单与备件进度已保存到本机。');
    } catch {
      setMessage('保存失败，请检查输入，或生成分享链接备份。');
    }
  };
  const generate = async () => {
    const ticket = ++request.current;
    setWorking(true);
    setMessage('正在生成 PNG…');
    try {
      const blob = await drawPoster(parseBuild(build), bike, parts.products);
      if (ticket === request.current) {
        const url = URL.createObjectURL(blob);
        setPoster({ blob, url });
        const link = document.createElement('a');
        link.href = url;
        link.download = 'velodex-dream-build.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setMessage('海报已生成并发起 PNG 下载；也可保存下方预览图或调用系统分享。');
      } else {
        setMessage('清单已变更，请重新生成海报。');
      }
    } catch {
      setMessage('图片或输入暂时无法导出，请检查数值后重试。');
    } finally {
      setWorking(false);
    }
  };
  const share = async () => {
    if (!poster) return;
    const file = new File([poster.blob], 'velodex-dream-build.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({
          files: [file],
          title: build.title,
          text: '我的 VÉLODEX 梦幻装车单',
        });
      else {
        const a = document.createElement('a');
        a.href = poster.url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setMessage('此浏览器不支持文件分享，已发起 PNG 下载，也可长按预览图保存。');
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === 'AbortError'
          ? '已取消分享，海报仍可下载。'
          : '系统分享暂不可用，请使用“下载 PNG”。',
      );
    }
  };
  const copy = async () => {
    try {
      const url = new URL(base, location.origin);
      url.search = '?view=workshop&tool=build';
      url.hash = `build=${encodeBuild(build)}`;
      setShareLink(url.href);
      await navigator.clipboard.writeText(url.href);
      setMessage('配置链接已复制。链接包含配件规格、重量方式、自填值和预算，不包含备齐进度。');
    } catch {
      setMessage('无法自动复制，可在下方选中并复制链接；如未生成链接，请先检查数值。');
    }
  };
  const g = totals(build, 'grams'),
    price = totals(build, 'yuan');
  const fit = fitCheck(build.items.wheels.choice, build.items.tires.choice);
  const framePrice = (
    chinaPrices.frames as Record<
      string,
      { amount: number; name: string; unit: string; source: string; note: string }
    >
  )[bike.id];
  const options = (slot: Slot) =>
    parts.products.filter(
      (p) => p.category === (slot === 'groupset' ? 'groupsets' : slot) && p.id !== 'aero111',
    );
  const changeBike = (next: Bike) =>
    setBuild((b) => ({
      ...b,
      bikeId: next.id,
      paintId: 'default',
      items: {
        ...b.items,
        frame: {
          ...b.items.frame,
          grams: '',
          yuan: '',
          checked: false,
          weightMode: 'auto',
          weightVariant: '',
        },
      },
    }));
  return (
    <div className="dream-layout">
      <div className="dream-editor" id="build-options">
        <section className="work-panel">
          <span className="eyebrow">01 / 灵感起点</span>
          <div className="work-actions">
            <button
              className="light-button"
              onClick={() => {
                setCleared(build);
                setBuild(newBuild(bike.id));
                setMessage('已新建草稿，本机保存的清单未改变。');
              }}
            >
              新建清单
            </button>
            {cleared && (
              <button
                className="light-button"
                onClick={() => {
                  setBuild(cleared);
                  setCleared(undefined);
                }}
              >
                恢复上一份草稿
              </button>
            )}
          </div>
          <h2>选择参考车型</h2>
          <label>
            清单名称
            <input
              maxLength={50}
              value={build.title}
              onChange={(e) => setBuild({ ...build, title: e.target.value })}
            />
          </label>
          <label>
            车架平台
            <select
              value={bike.id}
              onChange={(e) => changeBike(catalog.bikes.find((b) => b.id === e.target.value)!)}
            >
              {catalog.bikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {catalog.brands.find((x) => x.id === b.brandId)?.name} · {b.family}
                </option>
              ))}
            </select>
          </label>
          <div className="build-paints" aria-label="选择涂装">
            {paintsForBike(bike).map((p) => (
              <button
                key={p.id}
                aria-pressed={paint.id === p.id}
                onClick={() => setBuild({ ...build, paintId: p.id })}
              >
                <i style={{ background: p.hex }} />
                {p.name}
              </button>
            ))}
          </div>
          <p className="work-note">
            平台用于表达装车灵感，不代表该车型单独出售车架组。整车原配重量不会自动填入车架重量。
          </p>
        </section>
        <section className="work-panel">
          <span className="eyebrow">02 / 配件与备件清单</span>
          <h2>选择配件</h2>
          <p className="work-note">
            只选喜欢的配置，也能保存、分享和生成海报。预算与重量都可跳过。轮组、轮胎和脚踏按一对选配；重量助手会自动采用已核验资料，想调整时再展开。价格仍优先采用中国大陆官方售价。
          </p>
          <div className="build-items">
            {slots.map(([slot, label, scope]) => (
              <div className="build-item" key={slot}>
                <div className="build-item-head">
                  <h3>{label}</h3>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      aria-label={`${label}已备齐`}
                      checked={build.items[slot].checked}
                      onChange={(e) => update(slot, { checked: e.target.checked })}
                    />
                    已备齐
                  </label>
                </div>
                {slot === 'frame' ? (
                  <p>{bike.family}</p>
                ) : options(slot).length ? (
                  <label className="sr-label">
                    {label}型号
                    <select
                      aria-label={`${label}型号`}
                      value={build.items[slot].choice}
                      onChange={(e) => {
                        update(slot, {
                          choice: e.target.value,
                          custom: '',
                          grams: '',
                          weightMode: 'auto',
                          weightVariant: defaultWeightVariant(e.target.value),
                          yuan: '',
                          checked: false,
                        });
                      }}
                    >
                      <option value="">自定义 / 待选</option>
                      {options(slot).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {slot === 'tires' && weightReferences[build.items[slot].choice]?.length > 0 && (
                  <label>
                    轮胎规格（前后相同）
                    <select
                      aria-label="轮胎规格"
                      value={
                        weightReferences[build.items[slot].choice].some(
                          (r) => r.id === build.items[slot].weightVariant,
                        )
                          ? build.items[slot].weightVariant
                          : ''
                      }
                      onChange={(e) =>
                        update(slot, {
                          weightVariant: e.target.value,
                          grams: '',
                          weightMode: 'auto',
                          checked: false,
                        })
                      }
                    >
                      <option value="" disabled>
                        未指定规格 · 请选择
                      </option>
                      {weightReferences[build.items[slot].choice].map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <small>
                      规格对应官方重量资料；更换规格后重新采用参考值。前后不同请用自定义。
                    </small>
                  </label>
                )}
                {slot !== 'frame' && !build.items[slot].choice && (
                  <input
                    aria-label={`${label}自定义名称`}
                    placeholder="填写自定义型号"
                    maxLength={100}
                    value={build.items[slot].custom}
                    onChange={(e) => update(slot, { custom: e.target.value })}
                  />
                )}
                <small>{scope}</small>
                {slot === 'frame' && framePrice && (
                  <div className="domestic-price">
                    <strong>中国大陆官方参考 · ¥{framePrice.amount.toLocaleString('zh-CN')}</strong>
                    <small>
                      {framePrice.name} / {framePrice.unit} · 核验 {chinaPrices.checkedAt}
                    </small>
                    <small>{framePrice.note}</small>
                    <a href={framePrice.source} target="_blank" rel="noreferrer">
                      国内官网 ↗
                    </a>
                    <button
                      className="light-button"
                      onClick={() => update(slot, { yuan: String(framePrice.amount) })}
                    >
                      采用此国内参考价
                    </button>
                  </div>
                )}
                {slot !== 'frame' && build.items[slot].choice && (
                  <small>
                    {slot === 'wheels' && build.items[slot].choice === 'roval-rapide-clx3' ? (
                      <>
                        {chinaPrices.pending['roval-rapide-clx3'].note}{' '}
                        <a
                          href={chinaPrices.pending['roval-rapide-clx3'].source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          国内官网 ↗
                        </a>
                      </>
                    ) : (
                      '国内官方售价待核验；预算留空，不使用海外价格换算。'
                    )}
                  </small>
                )}
                <label>
                  {label}预算 / ¥ <span className="optional-label">选填</span>
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    placeholder="暂不填也没关系"
                    value={build.items[slot].yuan}
                    onChange={(e) => update(slot, { yuan: e.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
        <WeightAssistant build={build} update={update} />
      </div>
      <aside className="build-preview">
        <div className="dream-card">
          <span className="eyebrow">
            DREAM BUILD / {slots.filter(([s]) => build.items[s].checked).length} OF {slots.length}{' '}
            READY
          </span>
          <h2>{build.title || '我的梦幻装车单'}</h2>
          <a className="mobile-build-jump" href="#build-options">
            去选车与配件 ↓
          </a>
          <img src={imageUrl(paint.image)} alt={`${bike.family} ${paint.name} 灵感原图`} />
          <span className="work-note">灵感车型原图，不代表改装效果</span>
          <h3>{bike.family}</h3>
          <p>{paint.name}</p>
          <dl>
            {slots.slice(1, 4).map(([slot, label]) => (
              <div key={slot}>
                <dt>{label}</dt>
                <dd>{itemName(build, slot, bike, parts.products)}</dd>
              </div>
            ))}
          </dl>
          <div className="build-totals">
            <div>
              <strong>
                {g.known ? (g.value / 1000).toFixed(2) : '—'}
                <small> kg</small>
              </strong>
              <span>
                {g.known === g.total ? '清单估重' : g.known ? '已知部件小计' : '暂不估重'} ·{' '}
                {g.known}/{g.total} 项
              </span>
            </div>
            <div>
              <strong>{price.known ? `¥${price.value.toLocaleString('zh-CN')}` : '—'}</strong>
              <span>
                {price.known === price.total ? '清单预算' : '已填预算'} · {price.known}/
                {price.total} 项
              </span>
            </div>
          </div>
          <p className="work-note">
            {g.known
              ? `${weightBreakdown(build).official} 项官方参考，${weightBreakdown(build).manual} 项已保存 / 自填；${g.total - g.known} 项未计重。小计不代表整车重量。`
              : '重量与预算可以留空，不影响生成海报。'}
          </p>
        </div>
        <div className={`fit-result ${fit.level}`}>
          <strong>{fit.title}</strong>
          <p>{fit.text}</p>
          <a href={`${base}?view=workshop&tool=fit`}>打开轮胎与轮圈核对 →</a>
          <a href={`${base}?view=workshop&tool=interfaces`}>逐项核对装车接口 →</a>
          <p>还需确认车架的中轴、轴制式、制动接口、塔基、走线与轮胎间隙；此清单不构成装配认证。</p>
        </div>
        <div className="work-actions">
          <button className="light-button" disabled={!ready} onClick={save}>
            <Save size={16} />
            保存到本机
          </button>
          <button className="light-button" onClick={copy}>
            <LinkIcon size={16} />
            分享配置链接
          </button>
          <button className="dark-button" disabled={working} onClick={generate}>
            <Download size={16} />
            {working ? '正在生成…' : '生成并下载 PNG'}
          </button>
        </div>
        <p className="work-status" role="status">
          {message}
        </p>
        {shareLink && (
          <label>
            可复制的配置链接
            <input readOnly value={shareLink} onFocus={(e) => e.target.select()} />
          </label>
        )}
        {poster && (
          <section className="poster-result">
            <img src={poster.url} alt="梦幻装车单 PNG 海报预览" />
            <div className="work-actions">
              <a className="dark-button" href={poster.url} download="velodex-dream-build.png">
                <Download size={16} />
                下载 PNG
              </a>
              <button className="light-button" onClick={share}>
                <Share2 size={16} />
                系统分享
              </button>
            </div>
            <small>1080 × 1600 PNG · 也可长按图片保存</small>
          </section>
        )}
        <details className="work-panel">
          <summary>升级前后：保存此刻作为 A 方案</summary>
          <p>先记录 A，再修改上方配件，查看 B 与 A 的差异。快照仅保留到离开本页。</p>
          <button className="light-button" onClick={() => setBaseline(structuredClone(build))}>
            <Check size={16} />
            记录当前方案 A
          </button>
          {baseline && (
            <>
              <p>
                A：{baseline.title} → B：{build.title}
              </p>
              {(['grams', 'yuan'] as const).map((metric) => {
                const a = totals(baseline, metric),
                  b = totals(build, metric);
                const complete = a.known === a.total && b.known === b.total;
                return (
                  <p key={metric}>
                    {metric === 'grams' ? '重量' : '预算'}：
                    {complete
                      ? `${b.value - a.value > 0 ? '+' : ''}${(b.value - a.value).toFixed(1)} ${metric === 'grams' ? 'g' : '元'}`
                      : '仅展示配置变化；重量或预算不完整时，不推算整车差额。'}
                  </p>
                );
              })}
              <ul>
                {baseline.bikeId !== build.bikeId && <li>车架平台已变更</li>}
                {baseline.paintId !== build.paintId && <li>涂装已变更</li>}
                {slots
                  .filter(
                    ([s]) => JSON.stringify(baseline.items[s]) !== JSON.stringify(build.items[s]),
                  )
                  .map(([s, label]) => (
                    <li key={s}>{label}已变更</li>
                  ))}
              </ul>
            </>
          )}
        </details>
      </aside>
    </div>
  );
}
