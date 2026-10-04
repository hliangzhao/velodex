import type { Catalog } from '../types';
import { fitCoordinates, type FitSetup, type Plan } from './model';

export default function FitTransfer({
  plan,
  catalog,
  change,
}: {
  plan: Plan;
  catalog: Catalog;
  change: (p: Plan) => void;
}) {
  const a = fitCoordinates(plan.fit.a, catalog),
    b = fitCoordinates(plan.fit.b, catalog);
  const field = (side: 'a' | 'b', key: keyof FitSetup, value: string | number) =>
    change({ ...plan, fit: { ...plan.fit, [side]: { ...plan.fit[side], [key]: value } } });
  const delta = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)} mm`;
  return (
    <div className="st-fit">
      <div className="st-section-title">
        <div>
          <h2>把熟悉的设定带到另一辆车</h2>
          <p>以五通中心为原点，比较车把夹持点、车把前伸参考点与坐垫参考点。</p>
        </div>
      </div>
      <div className="st-fit-canvas">
        <svg viewBox="-480 -950 1300 1140" role="img" aria-label="两套骑姿设定的位置叠加，单位毫米">
          <defs>
            <pattern id="fit-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 H 0 V 50" fill="none" stroke="#dce3da" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="-480" y="-950" width="1300" height="1140" fill="url(#fit-grid)" />
          <path
            d="M -430 0 H 780 M 0 -910 V 130"
            stroke="#889b8b"
            strokeWidth="2"
            strokeDasharray="8 8"
          />
          {[a, b].map(
            (c, index) =>
              c && (
                <g
                  key={index}
                  stroke={index ? '#cf673d' : '#22624c'}
                  fill="none"
                  strokeWidth="5"
                  opacity=".86"
                >
                  <path
                    d={`M 0 0 L ${-Math.cos((c.g.seatAngle * Math.PI) / 180) * (c.g.seatTube || c.g.stack * 0.85)} ${-Math.sin((c.g.seatAngle * Math.PI) / 180) * (c.g.seatTube || c.g.stack * 0.85)} L ${c.g.reach} ${-c.g.stack} L 0 0`}
                    strokeWidth="3"
                    strokeDasharray="10 8"
                  />
                  <path
                    d={`M ${c.g.reach} ${-c.g.stack} L ${c.clamp.x} ${-c.clamp.y} H ${c.bar.x}`}
                  />
                  <path d={`M ${c.saddle.x - 30} ${-c.saddle.y} H ${c.saddle.x + 80}`} />
                  {[c.clamp, c.bar, c.saddle].map((pt, j) => (
                    <circle
                      key={j}
                      cx={pt.x}
                      cy={-pt.y}
                      r="7"
                      fill={index ? '#cf673d' : '#22624c'}
                    />
                  ))}
                </g>
              ),
          )}
          <circle r="8" fill="#173c30" />
          <text x="15" y="30" fontSize="22" fill="#173c30">
            五通中心 · 0, 0
          </text>
          {!a && !b && (
            <text x="170" y="-440" textAnchor="middle" fontSize="28" fill="#667769">
              选择两款车架与尺码开始比较
            </text>
          )}
        </svg>
        <p>绿色 A · 橙色 B · 网格 50 mm · 虚线为尺寸连线，不是车架管型</p>
      </div>
      {a && b && (
        <div className="st-metrics">
          <div>
            <small>B 相对 A · 车把前伸参考点</small>
            <strong>{delta(b.bar.x - a.bar.x)}</strong>
            <span>正值更靠前</span>
          </div>
          <div>
            <small>B 相对 A · 车把高度</small>
            <strong>{delta(b.bar.y - a.bar.y)}</strong>
            <span>正值更高</span>
          </div>
          <div>
            <small>B 相对 A · 坐垫高度</small>
            <strong>{delta(b.saddle.y - a.saddle.y)}</strong>
            <span>垂直坐标差</span>
          </div>
        </div>
      )}
      <div className="st-fit-columns">
        {(['a', 'b'] as const).map((side) => {
          const s = plan.fit[side],
            bike = catalog.bikes.find((b) => b.id === s.bikeId),
            c = side === 'a' ? a : b;
          return (
            <section className="st-panel" key={side}>
              <h3>{side === 'a' ? 'A · 参考设定' : 'B · 候选设定'}</h3>
              <label>
                车架
                <select
                  value={s.bikeId}
                  onChange={(e) => {
                    const bike = catalog.bikes.find((b) => b.id === e.target.value);
                    change({
                      ...plan,
                      fit: {
                        ...plan.fit,
                        [side]: {
                          ...s,
                          bikeId: bike?.id || '',
                          size: bike?.geometry.defaultSize || '',
                        },
                      },
                    });
                  }}
                >
                  <option value="">选择有完整几何的车架</option>
                  {catalog.bikes
                    .filter((b) => b.geometry.sizes.length)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.modelYear || b.edition}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                尺码
                <select value={s.size} onChange={(e) => field(side, 'size', e.target.value)}>
                  <option value="">选择尺码</option>
                  {bike?.geometry.sizes.map((g) => (
                    <option key={g.size}>{g.size}</option>
                  ))}
                </select>
              </label>
              <div className="st-fields">
                {(
                  [
                    ['spacers', '垫圈总高 / mm', 0, 80],
                    ['cover', '碗组上盖 / mm', 0, 50],
                    ['stemStack', '把立夹持高度 / mm', 10, 70],
                    ['stem', '把立中心距 / mm', 30, 200],
                    ['angle', '把立角度 / °', -40, 40],
                    ['barReach', '车把 Reach / mm', 0, 150],
                    ['saddleHeight', '五通至坐垫参考点 / mm', 400, 1100],
                    ['setback', '坐垫参考点后移 / mm', 0, 350],
                  ] as const
                ).map(([key, name, min, max]) => (
                  <label key={key}>
                    {name}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={s[key]}
                      onChange={(e) => {
                        if (
                          e.target.value !== '' &&
                          +e.target.value >= min &&
                          +e.target.value <= max
                        )
                          field(side, key, +e.target.value);
                      }}
                    />
                  </label>
                ))}
              </div>
              {c && (
                <p className="st-fine">
                  车把参考点 ({c.bar.x.toFixed(1)}, {c.bar.y.toFixed(1)})；坐垫 (
                  {c.saddle.x.toFixed(1)}, {c.saddle.y.toFixed(1)}) mm
                </p>
              )}
              {bike && (
                <a href={bike.geometry.source} target="_blank" rel="noreferrer">
                  车架尺寸来源 ↗
                </a>
              )}
            </section>
          );
        })}
      </div>
      <div className="st-note">
        <b>怎样测量</b>
        <p>
          两辆车使用同一坐垫参考点。坐高填写五通中心到该点的直线距离，后移填写该点在五通后方的水平距离。把立角度按与转向轴垂线的夹角填写，常见的下倾把立为负值。
        </p>
        <p>
          车把参考点采用水平 Reach
          投影，未模拟手变安装角、把横旋转和实际握持位置。调整值是试算输入，不是厂商允许范围；垫圈上限、前叉舵管、座管插入量和坐垫导轨范围须按实物说明核对。
        </p>
      </div>
    </div>
  );
}
