import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { imageUrl } from './catalog';
import './photo-study.css';

export type PhotoAsset = {
  id: string;
  name: string;
  image: string;
  source: string;
  note?: string;
  imageTone?: 'dark';
};
const remoteImage = (source: string) => /^https:\/\/.+\.(?:jpe?g|png|webp)(?:\?.*)?$/i.test(source);
export default function PhotoViewer({
  paint,
  name,
  onClose,
  alternatives = [],
}: {
  paint: PhotoAsset;
  name: string;
  onClose: () => void;
  alternatives?: PhotoAsset[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [comparison, setComparison] = useState(''),
    [grid, setGrid] = useState(false);
  const other = alternatives.find((p) => p.id === comparison);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    const el = dialog.current;
    el?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="photo-study"
      aria-label={`${name} 照片观察台`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <span>照片观察台</span>
          <h2>{name}</h2>
        </div>
        <button autoFocus aria-label="关闭照片观察台" onClick={onClose}>
          <X size={23} />
        </button>
      </header>
      <div className="photo-study-tools">
        <label>
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
          参考网格
        </label>
        {alternatives.some((p) => p.id !== paint.id) && (
          <label>
            并排比较
            <select value={comparison} onChange={(e) => setComparison(e.target.value)}>
              <option value="">只看当前图片</option>
              {alternatives
                .filter((p) => p.id !== paint.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <div className={`photo-study-panes ${other ? 'is-comparing' : ''}`}>
        <PhotoPane key={`primary:${paint.id}:${paint.image}`} asset={paint} grid={grid} />
        {other && (
          <PhotoPane key={`comparison:${other.id}:${other.image}`} asset={other} grid={grid} />
        )}
      </div>
      <p className="photo-study-note">
        每张图可独立双指缩放、拖动或滚轮放大；双击切换放大。不同照片的角度、透视和比例可能不同，网格只辅助观察；车架尺寸请以几何表和等比例几何对比为准。
      </p>
    </dialog>,
    document.body,
  );
}
function PhotoPane({ asset, grid }: { asset: PhotoAsset; grid: boolean }) {
  const stage = useRef<HTMLDivElement>(null),
    points = useRef(new Map<number, { x: number; y: number }>());
  const [transform, setTransform] = useState({ z: 1, x: 0, y: 0 }),
    live = useRef(transform);
  const [natural, setNatural] = useState({ w: 0, h: 0 }),
    [box, setBox] = useState({ w: 1, h: 1 });
  const [original, setOriginal] = useState(false),
    [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const gesture = useRef<{
    points: { x: number; y: number }[];
    transform: typeof transform;
  } | null>(null);
  const fit = natural.w && natural.h ? Math.min(box.w / natural.w, box.h / natural.h) : 1;
  const maxZoom = Math.max(8, 1 / fit);
  const constrain = (t: typeof transform) => {
    const z = Math.min(maxZoom, Math.max(1, t.z));
    const mx = Math.max(0, (natural.w * fit * z - box.w) / 2),
      my = Math.max(0, (natural.h * fit * z - box.h) / 2);
    return { z, x: Math.max(-mx, Math.min(mx, t.x)), y: Math.max(-my, Math.min(my, t.y)) };
  };
  const apply = (t: typeof transform) => {
    const next = constrain(t);
    live.current = next;
    setTransform(next);
  };
  const zoom = (factor: number, point = { x: 0, y: 0 }) => {
    const current = live.current,
      z = Math.min(maxZoom, Math.max(1, current.z * factor)),
      f = z / current.z;
    apply({ z, x: point.x - (point.x - current.x) * f, y: point.y - (point.y - current.y) * f });
  };
  const rebase = () => {
    gesture.current = { points: [...points.current.values()], transform: live.current };
  };
  useEffect(() => {
    const el = stage.current!;
    const ro = new ResizeObserver(([entry]) => {
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
      live.current = { z: 1, x: 0, y: 0 };
      setTransform(live.current);
      points.current.clear();
      gesture.current = null;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = stage.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY / 450), {
        x: e.clientX - r.left - r.width / 2,
        y: e.clientY - r.top - r.height / 2,
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [natural, box]);
  const release = (id: number) => {
    points.current.delete(id);
    rebase();
  };
  const url = original ? asset.source : imageUrl(asset.image);
  return (
    <section className="photo-study-pane">
      <h3>{asset.name}</h3>
      <div
        ref={stage}
        className={`photo-study-stage ${grid ? 'has-grid' : ''} ${asset.imageTone === 'dark' ? 'is-dark' : ''}`}
        tabIndex={0}
        role="region"
        aria-label={`${asset.name} 图片，方向键移动，加减号缩放，0 复位`}
        onDoubleClick={() => zoom(live.current.z > 1 ? 1 / live.current.z : 2.5)}
        onKeyDown={(e) => {
          if (
            ['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
          ) {
            e.preventDefault();
            if (e.key === '+' || e.key === '=') zoom(1.25);
            else if (e.key === '-') zoom(0.8);
            else if (e.key === '0') apply({ z: 1, x: 0, y: 0 });
            else
              apply({
                ...live.current,
                x: live.current.x + (e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0),
                y: live.current.y + (e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0),
              });
          }
        }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          points.current.set(e.pointerId, {
            x: e.clientX - r.left - r.width / 2,
            y: e.clientY - r.top - r.height / 2,
          });
          e.currentTarget.setPointerCapture(e.pointerId);
          rebase();
        }}
        onPointerMove={(e) => {
          if (!points.current.has(e.pointerId) || !gesture.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          points.current.set(e.pointerId, {
            x: e.clientX - r.left - r.width / 2,
            y: e.clientY - r.top - r.height / 2,
          });
          const now = [...points.current.values()],
            old = gesture.current.points,
            t = gesture.current.transform;
          if (now.length >= 2 && old.length >= 2) {
            const mid = (p: typeof now) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
            const a = mid(old),
              b = mid(now),
              distance = (p: typeof now) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
              z = Math.min(
                maxZoom,
                Math.max(1, (t.z * distance(now)) / Math.max(1, distance(old))),
              ),
              f = z / t.z;
            apply({ z, x: b.x - (a.x - t.x) * f, y: b.y - (a.y - t.y) * f });
          } else if (now.length === 1 && old.length === 1)
            apply({ ...t, x: t.x + now[0].x - old[0].x, y: t.y + now[0].y - old[0].y });
        }}
        onPointerUp={(e) => release(e.pointerId)}
        onPointerCancel={(e) => release(e.pointerId)}
        onLostPointerCapture={(e) => release(e.pointerId)}
      >
        {!failed && (
          <img
            key={url}
            src={url}
            alt={asset.name}
            draggable={false}
            onLoad={(e) => {
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
              setLoaded(true);
            }}
            onError={() => {
              setFailed(true);
              setLoaded(false);
            }}
            style={{
              transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.z})`,
            }}
          />
        )}
        {failed && (
          <p className="photo-study-error">
            图片未能加载。
            <button
              onClick={() => {
                setOriginal(false);
                setFailed(false);
                setLoaded(false);
                apply({ z: 1, x: 0, y: 0 });
              }}
            >
              重新加载站内图片
            </button>
          </p>
        )}
        {!loaded && !failed && <span className="photo-study-loading">正在读取图片…</span>}
      </div>
      <div className="photo-study-controls">
        <button
          aria-label={`缩小 ${asset.name}`}
          disabled={transform.z <= 1}
          onClick={() => zoom(0.8)}
        >
          <Minus size={16} />
        </button>
        <output>{transform.z.toFixed(1)}×</output>
        <button aria-label={`放大 ${asset.name}`} onClick={() => zoom(1.25)}>
          <Plus size={16} />
        </button>
        <button onClick={() => apply({ z: 1, x: 0, y: 0 })}>
          <RotateCcw size={14} />
          适应窗口
        </button>
        <button disabled={!loaded || fit >= 1} onClick={() => apply({ z: 1 / fit, x: 0, y: 0 })}>
          原图 1:1
        </button>
      </div>
      <div className="photo-study-source">
        <p>
          {loaded
            ? `${natural.w} × ${natural.h} 像素 · ${original ? '官网原图' : '站内图片'}`
            : '图片信息'}{' '}
          · 放大不会增加原图细节。
        </p>
        {remoteImage(asset.source) && !original && (
          <button
            onClick={() => {
              setOriginal(true);
              setFailed(false);
              setLoaded(false);
              apply({ z: 1, x: 0, y: 0 });
            }}
          >
            读取官网原图（需联网）
          </button>
        )}
        <a href={asset.source} target="_blank" rel="noreferrer">
          图片来源
          <ArrowUpRight size={12} />
        </a>
        {asset.note && <p>{asset.note}</p>}
      </div>
    </section>
  );
}
