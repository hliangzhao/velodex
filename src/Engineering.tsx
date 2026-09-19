import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Bike, GeometrySize } from './types';

export default function Engineering({
  bike,
  geometry: g,
  onSize,
}: {
  bike: Bike;
  geometry: GeometrySize;
  onSize: (size: string) => void;
}) {
  const [tab, setTab] = useState('geometry');
  const [speed, setSpeed] = useState(35);
  const [cda, setCda] = useState(0.3);
  const power = 0.5 * 1.225 * cda * (speed / 3.6) ** 3;
  const ratio = g.stack / g.reach;
  return (
    <section className="engineering" aria-label="车架几何与空气动力学">
      <div className="engineering-heading">
        <div>
          <span className="eyebrow">BEYOND THE SILHOUETTE</span>
          <h2>外形之外，读懂一台车。</h2>
        </div>
        <div className="engineering-tabs">
          <button aria-pressed={tab === 'geometry'} onClick={() => setTab('geometry')}>
            车架几何
          </button>
          <button aria-pressed={tab === 'aero'} onClick={() => setTab('aero')}>
            空气动力学
          </button>
        </div>
      </div>
      {tab === 'geometry' ? (
        <div className="geometry-layout">
          <div className="geometry-visual">
            <div className="geometry-kicker">
              <span>{bike.family} / GEOMETRY</span>
              <span>{g.size} 码</span>
            </div>
            <GeometryDiagram g={g} />
            <p>关键尺寸示意 · 不包含把立、垫圈与骑手姿态</p>
          </div>
          <div className="geometry-details">
            <div className="size-selector" aria-label="车架尺码">
              {bike.geometry.sizes.map((size) => (
                <button
                  key={size.size}
                  aria-pressed={size.size === g.size}
                  onClick={() => onSize(size.size)}
                >
                  {size.size}
                </button>
              ))}
            </div>
            <dl className="geometry-grid">
              {[
                ['Stack', '车架堆高', g.stack, 'mm'],
                ['Reach', '车架前伸', g.reach, 'mm'],
                ['头管角', '转向轴线', g.headAngle, '°'],
                ['座管角', '座管轴线', g.seatAngle, '°'],
                ['轴距', '前后轴中心', g.wheelbase ?? '未列出', 'mm'],
                ['后下叉', '五通至后轴', g.chainstay, 'mm'],
                ['BB Drop', '五通下沉量', g.bbDrop, 'mm'],
                ['头管长度', '原厂参考', g.headTube, 'mm'],
              ].map(([name, label, value, unit]) => (
                <div key={name}>
                  <dt>
                    {name}
                    <small>{label}</small>
                  </dt>
                  <dd>
                    {value}
                    <span>{typeof value === 'number' ? unit : ''}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="engineering-note">
              Stack / Reach 比值 {ratio.toFixed(2)}。相同 Reach 下，更高的 Stack
              通常给前端留出更高的位置；实际把位还取决于垫圈、把立和车把。{bike.geometry.note}
            </p>
            <a className="source-link" href={bike.geometry.source} target="_blank" rel="noreferrer">
              {bike.geometry.sourceLabel}
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      ) : (
        <div className="aero-layout">
          <div className="aero-story">
            <span className="eyebrow">AERODYNAMIC DESIGN</span>
            <h3>{bike.aero.title}</h3>
            <p>{bike.aero.description}</p>
            <div className="aero-terms">
              <div>
                <strong>CdA</strong>
                <span>阻力系数 × 迎风面积。骑手姿态、装备和自行车一起决定整套系统的风阻。</span>
              </div>
              <div>
                <strong>Yaw</strong>
                <span>气流相对行进方向的夹角。侧风下的表现，不能用单个正面迎风数值概括。</span>
              </div>
            </div>
            <p className="engineering-note">{bike.aero.limit}</p>
            <a className="source-link" href={bike.aero.source} target="_blank" rel="noreferrer">
              查看车型官方资料
              <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="aero-calculator">
            <div className="calculator-top">
              <span>风阻功率演示</span>
              <span>示例模型 · 非本车实测</span>
            </div>
            <div className="power-result">
              <strong>{Math.round(power)}</strong>
              <span>
                W<small>仅克服空气阻力</small>
              </span>
            </div>
            <label>
              车速 <output>{speed} km/h</output>
              <input
                aria-label="演示车速"
                type="range"
                min="15"
                max="60"
                step="1"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
            <label>
              骑手 + 整车 CdA <output>{cda.toFixed(2)} m²</output>
              <input
                aria-label="演示 CdA"
                type="range"
                min="0.15"
                max="0.5"
                step="0.01"
                value={cda}
                onChange={(e) => setCda(Number(e.target.value))}
              />
            </label>
            <p>P = ½ ρ · CdA · v³</p>
            <small>
              静止空气、匀速行驶，ρ = 1.225 kg/m³。未计滚阻、坡度与传动损耗；默认 CdA
              仅为教学示例，不能推算此车的真实骑行功率。
            </small>
            <a
              href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/"
              target="_blank"
              rel="noreferrer"
            >
              公式依据：NASA 阻力方程 ↗
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
function GeometryDiagram({ g }: { g: GeometrySize }) {
  const scale = 0.39,
    bb = { x: 232, y: 298 };
  const rearX = bb.x - Math.sqrt(g.chainstay ** 2 - g.bbDrop ** 2) * scale;
  const wheelY = bb.y - g.bbDrop * scale;
  const frontX = rearX + (g.wheelbase ?? 985) * scale;
  const ht = { x: bb.x + g.reach * scale, y: bb.y - g.stack * scale };
  const hb = {
    x: ht.x + Math.cos((g.headAngle * Math.PI) / 180) * g.headTube * scale,
    y: ht.y + Math.sin((g.headAngle * Math.PI) / 180) * g.headTube * scale,
  };
  const st = {
    x: bb.x - Math.cos((g.seatAngle * Math.PI) / 180) * g.stack * 0.9 * scale,
    y: bb.y - Math.sin((g.seatAngle * Math.PI) / 180) * g.stack * 0.9 * scale,
  };
  return (
    <svg
      viewBox="-60 0 660 450"
      role="img"
      aria-label={`${g.size} 码几何示意：Stack ${g.stack} 毫米，Reach ${g.reach} 毫米`}
    >
      <g fill="none" stroke="#c5cdbe" strokeWidth="2">
        <circle cx={rearX} cy={wheelY} r={126} />
        <circle cx={frontX} cy={wheelY} r={126} />
      </g>
      <g fill="none" stroke="#516444" strokeWidth="7" strokeLinejoin="round">
        <path
          d={`M ${bb.x} ${bb.y} L ${st.x} ${st.y} L ${ht.x} ${ht.y} L ${hb.x} ${hb.y} Z M ${st.x} ${st.y} L ${rearX} ${wheelY} L ${bb.x} ${bb.y} M ${hb.x} ${hb.y} L ${frontX} ${wheelY}`}
        />
      </g>
      <g stroke="#92aa47" strokeWidth="1.5" strokeDasharray="4 4">
        <path
          d={`M ${bb.x} ${bb.y} V ${ht.y - 28} H ${ht.x} V ${ht.y} M ${bb.x} ${bb.y} H ${ht.x + 38} V ${ht.y} H ${ht.x}`}
        />
      </g>
      <g fill="#536a2b" fontFamily="Barlow, sans-serif" fontSize="16">
        <text x={(bb.x + ht.x) / 2} y={ht.y - 38} textAnchor="middle">
          REACH {g.reach}
        </text>
        <text
          x={ht.x + 47}
          y={(bb.y + ht.y) / 2}
          transform={`rotate(90 ${ht.x + 47} ${(bb.y + ht.y) / 2})`}
          textAnchor="middle"
        >
          STACK {g.stack}
        </text>
      </g>
      <circle cx={bb.x} cy={bb.y} r={7} fill="#d5f660" stroke="#536a2b" />
      <circle cx={ht.x} cy={ht.y} r={6} fill="#d5f660" stroke="#536a2b" />
    </svg>
  );
}
