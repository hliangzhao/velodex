import { useRef, useState } from 'react';
import type { Bike } from '../types';
import { imageUrl } from '../catalog';
import { paintsForBike } from '../bikePaints';
import { type Plan, type Point } from './model';
import PhotoButton from '../PhotoButton';

export default function VisualBuild({
  plan,
  bike,
  change,
}: {
  plan: Plan;
  bike?: Bike;
  change: (p: Plan) => void;
}) {
  const [mode, setMode] = useState<'photo' | 'preview'>('photo'),
    [points, setPoints] = useState<Point[]>([]),
    [calibrating, setCalibrating] = useState(false),
    [calibrationError, setCalibrationError] = useState(''),
    [zoom, setZoom] = useState(1);
  const image = useRef<HTMLImageElement>(null);
  const [naturalRatio, setNaturalRatio] = useState(0);
  const paints = bike ? paintsForBike(bike) : [],
    paint = paints.find((p) => p.id === plan.paintId) || paints[0];
  const ratio = naturalRatio || paint?.imageRatio || bike?.imageRatio || 1.5;
  const calibration = plan.calibration;
  const w = 1000,
    h = 1000 / ratio;
  const radius = calibration
    ? Math.hypot(
        (calibration.rear.x - calibration.edge.x) * w,
        (calibration.rear.y - calibration.edge.y) * h,
      )
    : 0;
  const physical = calibration?.radiusMm || plan.visual.diameter / 2 + plan.visual.tire;
  const scale = radius / physical;
  const click = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!calibrating || !image.current) return;
    const r = image.current.getBoundingClientRect();
    const pt = {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    };
    const next = [...points, pt];
    setPoints(next);
    if (next.length === 3) {
      const wheelRadius = Math.hypot((next[0].x - next[2].x) * w, (next[0].y - next[2].y) * h);
      const wheelbase = Math.hypot((next[0].x - next[1].x) * w, (next[0].y - next[1].y) * h);
      if (wheelRadius < 20 || wheelbase < wheelRadius * 2 || wheelbase > wheelRadius * 5) {
        setPoints([]);
        setCalibrationError('这三个点无法确定合理的车轮比例，请从后轮轴心重新标定。');
        return;
      }
      setCalibrationError('');
      change({
        ...plan,
        calibration: {
          rear: next[0],
          front: next[1],
          edge: next[2],
          radiusMm: plan.visual.diameter / 2 + plan.visual.tire,
        },
      });
      setCalibrating(false);
      setMode('preview');
    }
  };
  return (
    <section className="st-visual">
      <div className="st-visual-top">
        <span>{bike ? bike.family : '你的下一辆车'}</span>
        <div className="st-segment">
          <button aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>
            原车照片
          </button>
          <button aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>
            轮组比例
          </button>
        </div>
      </div>
      {!paint ? (
        <div className="st-visual-empty">
          <svg viewBox="0 0 640 300" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="135" cy="190" r="80" />
              <circle cx="490" cy="190" r="80" />
              <path d="M135 190 250 60 440 70 330 190 250 60 M135 190 H330 M440 70 490 190 M440 70 450 38 483 38 M235 50 H275" />
            </g>
          </svg>
          <h2>从自己的车开始</h2>
          <p>选择任意车型，或填写车名建立清单。没有收录的零件也可以加入。</p>
        </div>
      ) : (
        <>
          <div className={'st-photo-scroll' + (calibrating ? ' is-calibrating' : '')}>
            <div className="st-photo-plane" style={{ width: `${zoom * 100}%` }}>
              <img
                ref={image}
                src={imageUrl(paint.image)}
                alt={`${bike?.family} ${paint.name} 原厂照片`}
                onLoad={(e) =>
                  setNaturalRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
                }
                onClick={click}
                draggable={false}
              />
              {(calibrating || (mode === 'preview' && calibration)) && (
                <svg className="st-wheel-overlay" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
                  {mode === 'preview' &&
                    calibration &&
                    radius > 10 &&
                    [calibration.rear, calibration.front].map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x * w}
                          cy={p.y * h}
                          r={(plan.visual.diameter / 2 + plan.visual.tire / 2) * scale}
                          fill="none"
                          stroke={plan.visual.sidewall === 'tan' ? '#b99360' : '#171c19'}
                          strokeWidth={plan.visual.tire * scale}
                        />
                        <circle
                          cx={p.x * w}
                          cy={p.y * h}
                          r={
                            (plan.visual.diameter / 2 -
                              (i === 0 ? plan.visual.rearDepth : plan.visual.depth) / 2) *
                            scale
                          }
                          fill="none"
                          stroke="#222a28"
                          strokeWidth={
                            (i === 0 ? plan.visual.rearDepth : plan.visual.depth) * scale
                          }
                        />
                        <circle
                          cx={p.x * w}
                          cy={p.y * h}
                          r={
                            (plan.visual.diameter / 2 -
                              (i === 0 ? plan.visual.rearDepth : plan.visual.depth)) *
                            scale
                          }
                          fill="none"
                          stroke="#697570"
                          strokeWidth="1"
                        />
                      </g>
                    ))}
                  {calibrating &&
                    points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x * w}
                          cy={p.y * h}
                          r="8"
                          fill="#d5ed87"
                          stroke="#173c30"
                          strokeWidth="3"
                        />
                        <text x={p.x * w + 14} y={p.y * h} fontSize="22">
                          {i + 1}
                        </text>
                      </g>
                    ))}
                </svg>
              )}
            </div>
          </div>
          <div className="st-visual-controls">
            <PhotoButton
              asset={{ ...paint, name: `${bike?.family || ''} ${paint.name}` }}
              alternatives={paints}
            />
            <label>
              查看比例
              <select value={zoom} onChange={(e) => setZoom(+e.target.value)}>
                <option value="1">100%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
              </select>
            </label>
            <button
              onClick={() => {
                setCalibrating(!calibrating);
                setPoints([]);
                setCalibrationError('');
                setZoom(1);
              }}
            >
              {calibrating ? '取消标定' : calibration ? '重新标定轮轴' : '标定轮轴'}
            </button>
          </div>
          {calibrating && (
            <p role="status" className="st-note">
              依次点击：{['① 后轮轴心', '② 前轮轴心', '③ 后轮轮胎最外缘'][points.length]}
              。请使用接近正侧面的照片，先将下方轮径与胎宽设为原车规格。
            </p>
          )}
          {calibrationError && (
            <p role="alert" className="st-note">
              {calibrationError}
            </p>
          )}
          {mode === 'preview' && (
            <div className="st-preview-controls">
              {!calibration && <p>先标定两根轮轴和轮胎外缘，让比例与这张照片对应。</p>}
              <label>
                前轮框高 {plan.visual.depth} mm
                <input
                  aria-label="预览前轮框高"
                  type="range"
                  min="15"
                  max="100"
                  value={plan.visual.depth}
                  onChange={(e) =>
                    change({ ...plan, visual: { ...plan.visual, depth: +e.target.value } })
                  }
                />
              </label>
              <label>
                后轮框高 {plan.visual.rearDepth} mm
                <input
                  aria-label="预览后轮框高"
                  type="range"
                  min="15"
                  max="100"
                  value={plan.visual.rearDepth}
                  onChange={(e) =>
                    change({ ...plan, visual: { ...plan.visual, rearDepth: +e.target.value } })
                  }
                />
              </label>
              <label>
                胎宽 {plan.visual.tire} mm
                <input
                  aria-label="预览胎宽"
                  type="range"
                  min="20"
                  max="65"
                  value={plan.visual.tire}
                  onChange={(e) =>
                    change({ ...plan, visual: { ...plan.visual, tire: +e.target.value } })
                  }
                />
              </label>
              <label>
                轮径
                <select
                  value={plan.visual.diameter}
                  onChange={(e) =>
                    change({ ...plan, visual: { ...plan.visual, diameter: +e.target.value } })
                  }
                >
                  <option value="622">700C / 622</option>
                  <option value="584">650B / 584</option>
                  <option value="559">26″ / 559</option>
                </select>
              </label>
              <label>
                胎侧
                <select
                  value={plan.visual.sidewall}
                  onChange={(e) =>
                    change({
                      ...plan,
                      visual: { ...plan.visual, sidewall: e.target.value as 'black' | 'tan' },
                    })
                  }
                >
                  <option value="black">黑色</option>
                  <option value="tan">棕色</option>
                </select>
              </label>
            </div>
          )}
          {paints.length > 1 && (
            <div className="st-paints">
              {paints.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={paint.id === p.id}
                  onClick={() => {
                    setPoints([]);
                    setCalibrating(false);
                    change({ ...plan, paintId: p.id, calibration: null });
                  }}
                >
                  <i style={{ background: p.hex }} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <p className="st-fine">
            {mode === 'photo'
              ? '原厂照片保留原装配件；所选清单见下方。'
              : '按输入尺寸叠加轮圈与胎侧，保留原图辐条和花鼓，不代表所选产品实装、胎宽实测或装配净空。'}
            {paint.note}
          </p>
        </>
      )}
    </section>
  );
}
