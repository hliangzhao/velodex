import { useState } from 'react';
import { airPower, massPowerSaving } from './reading';
import { gear } from './workshop';

function Slider({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="reading-slider">
      <span>
        {label}
        <output>
          {value} {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={`${value} ${unit}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function ReadingLabs({ type }: { type: 'aero' | 'gears' | 'mass' }) {
  return (
    <section className="reading-lab" id="try-it">
      <span className="eyebrow">TRY IT / 拖动参数，观察变化</span>
      {type === 'aero' ? <AeroLab /> : type === 'gears' ? <GearLab /> : <MassLab />}
    </section>
  );
}

function AeroLab() {
  const [speed, setSpeed] = useState(30),
    [cda, setCda] = useState(0.3),
    [wind, setWind] = useState(0);
  const power = airPower(speed, cda, wind);
  const maximum = airPower(55, cda, wind);
  return (
    <>
      <h2>同样的地速，逆风会改变什么？</h2>
      <div className="reading-lab-grid">
        <div>
          <Slider label="地速" value={speed} unit="km/h" min={15} max={55} onChange={setSpeed} />
          <Slider
            label="假设 CdA"
            value={cda}
            unit="m²"
            min={0.2}
            max={0.5}
            step={0.01}
            onChange={setCda}
          />
          <Slider label="正面逆风" value={wind} unit="km/h" min={0} max={20} onChange={setWind} />
        </div>
        <div className="lab-result" aria-live="polite" aria-atomic="true">
          <small>仅空气阻力对应的轮端功率</small>
          <strong>
            {power.toFixed(1)}
            <span> W</span>
          </strong>
          <p>
            相对空气速度 {speed + wind} km/h
            <br />同 CdA、无风时 {airPower(speed, cda).toFixed(1)} W
          </p>
        </div>
      </div>
      <div className="lab-bars" aria-label="同一 CdA 和逆风下的速度比较">
        {[20, 30, 40, 50].map((s) => (
          <div key={s}>
            <span>{s} km/h</span>
            <div>
              <i style={{ width: `${(airPower(s, cda, wind) / maximum) * 100}%` }} />
            </div>
            <b>{airPower(s, cda, wind).toFixed(0)} W</b>
          </div>
        ))}
      </div>
      <p className="lab-note">
        空气密度固定为 1.225
        kg/m³。只考虑正面来流；不含滚阻、坡度、加速、跟骑和传动损失。滑块不代表测得了你的 CdA。
      </p>
    </>
  );
}

function GearLab() {
  const [cadence, setCadence] = useState(90);
  const combinations = [
    [34, 34],
    [39, 36],
    [50, 17],
    [52, 11],
    [48, 10],
  ];
  return (
    <>
      <h2>踏频与各挡位的理论速度</h2>
      <Slider label="踏频" value={cadence} unit="rpm" min={50} max={120} onChange={setCadence} />
      <p className="reading-table-hint">左右滑动表格，查看完整速度列 →</p>
      <div className="reading-table-wrap">
        <table>
          <caption>示例轮周固定 2.13 m；持续踩踏的理论值</caption>
          <thead>
            <tr>
              <th scope="col">牙盘 / 飞轮</th>
              <th scope="col">齿比</th>
              <th scope="col">每圈前进</th>
              <th scope="col">{cadence} rpm 速度</th>
            </tr>
          </thead>
          <tbody>
            {combinations.map(([front, rear]) => {
              const value = gear(front, rear, 2130, cadence)!;
              return (
                <tr key={`${front}-${rear}`}>
                  <th scope="row">
                    {front} / {rear}
                  </th>
                  <td>{value.ratio.toFixed(2)}</td>
                  <td>{value.development.toFixed(2)} m</td>
                  <td>{value.speed.toFixed(1)} km/h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="lab-note">
        这里只把踏频换算为理论速度，不判断你能否输出维持该速度所需的功率。工坊中可输入自己的实测轮周与完整飞轮。
      </p>
    </>
  );
}

function MassLab() {
  const [speed, setSpeed] = useState(20),
    [grade, setGrade] = useState(6),
    [mass, setMass] = useState(1),
    [cda, setCda] = useState(0.02);
  const saving = massPowerSaving(speed, grade, mass);
  return (
    <>
      <h2>同一工况，减重与减阻各省多少功率？</h2>
      <div className="reading-lab-grid">
        <div>
          <Slider label="沿路速度" value={speed} unit="km/h" min={8} max={45} onChange={setSpeed} />
          <Slider
            label="坡度"
            value={grade}
            unit="%"
            min={0}
            max={15}
            step={0.5}
            onChange={setGrade}
          />
          <Slider
            label="减少的质量"
            value={mass}
            unit="kg"
            min={0.2}
            max={2}
            step={0.1}
            onChange={setMass}
          />
          <Slider
            label="假设 CdA 降幅"
            value={cda}
            unit="m²"
            min={0.005}
            max={0.05}
            step={0.005}
            onChange={setCda}
          />
        </div>
        <div className="mass-results" aria-live="polite" aria-atomic="true">
          <div className="lab-result">
            <small>减重：重力 + 滚阻</small>
            <strong>
              {(saving.gravity + saving.rolling).toFixed(1)}
              <span> W</span>
            </strong>
            <p>
              重力 {saving.gravity.toFixed(1)} W / 滚阻 {saving.rolling.toFixed(1)} W
            </p>
          </div>
          <div className="lab-result">
            <small>降低 CdA：空气阻力</small>
            <strong>
              {airPower(speed, cda).toFixed(1)}
              <span> W</span>
            </strong>
            <p>保持其余变量相同</p>
          </div>
        </div>
      </div>
      <p className="lab-note">
        固定速度，无风，空气密度 1.225 kg/m³，滚阻系数
        0.004。结果为轮端机械功率差，不含加速、传动损失；CdA 降幅是演示假设，不对应任何产品承诺。
      </p>
    </>
  );
}
