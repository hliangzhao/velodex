import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Bike, GeometrySize } from './types';
import GeometryDiagram from './GeometryDiagram';

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
            <GeometryDiagram g={g} bikeId={bike.id} />
            <p>
              A—H 对照参数卡片 · 单位 mm / ° · 轮廓为尺寸关系示意
              {g.wheelbase === null && '；轴距未公布，前轴位置仅作示意'}
            </p>
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
              ].map(([name, label, value, unit], index) => (
                <div key={name}>
                  <dt>
                    <span className="geometry-key">{String.fromCharCode(65 + index)}</span> {name}
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
