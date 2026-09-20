import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { Paint } from './types';
import { imageUrl } from './catalog';

export default function PhotoViewer({
  paint,
  name,
  onClose,
}: {
  paint: Paint;
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState('');
  const drag = useRef<{ x: number; y: number } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const clampPan = (x: number, y: number, scale: number) => {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const changeZoom = (value: number) => {
    const next = Math.max(1, Math.min(4, value));
    setZoom(next);
    setPan((p) => clampPan(p.x, p.y, next));
  };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="photo-dialog"
      aria-label={`${name} 官方照片细看`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">PHOTO STUDY / 官方照片细看</span>
          <h2>{name}</h2>
          <p>{paint.name}</p>
        </div>
        <button autoFocus onClick={onClose} aria-label="关闭照片细看">
          <X size={24} />
        </button>
      </header>
      <div
        ref={viewport}
        className={`photo-inspect ${paint.imageTone === 'dark' ? 'photo-inspect-dark' : ''}`}
        tabIndex={0}
        role="region"
        aria-label="照片查看区，方向键移动，加减号缩放，0 复位"
        onKeyDown={(event) => {
          const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          if (event.key === '+' || event.key === '=') changeZoom(zoom + 0.25);
          else if (event.key === '-') changeZoom(zoom - 0.25);
          else if (event.key === '0') {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          } else
            setPan((p) =>
              clampPan(
                p.x + (event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0),
                p.y + (event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0),
                zoom,
              ),
            );
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary) return;
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || !event.isPrimary) return;
          const dx = event.clientX - drag.current.x,
            dy = event.clientY - drag.current.y;
          drag.current = { x: event.clientX, y: event.clientY };
          setPan((p) => clampPan(p.x + dx, p.y + dy, zoom));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <img
          src={imageUrl(paint.image)}
          alt={`${name} · ${paint.name} 官方原图`}
          draggable={false}
          onLoad={(event) =>
            setDimensions(
              `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`,
            )
          }
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        />
        {zoom === 1 && <span className="photo-hint">放大后拖拽，观察真实细节</span>}
      </div>
      <div className="photo-controls">
        <button aria-label="缩小照片" disabled={zoom <= 1} onClick={() => changeZoom(zoom - 0.25)}>
          <Minus size={18} />
        </button>
        <label>
          <span className="sr-only">照片放大倍率</span>
          <input
            type="range"
            min="1"
            max="4"
            step=".05"
            value={zoom}
            aria-label="照片放大倍率"
            onChange={(e) => changeZoom(Number(e.target.value))}
          />
        </label>
        <output>{zoom.toFixed(2)}×</output>
        <button aria-label="放大照片" disabled={zoom >= 4} onClick={() => changeZoom(zoom + 0.25)}>
          <Plus size={18} />
        </button>
        <button
          className="photo-reset"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={16} />
          复位
        </button>
      </div>
      <div className="photo-disclaimer">
        <p>
          原图 {dimensions || '加载中'} · 放大不增加原图细节。方向键移动，+/− 缩放，0 复位。
          {paint.note}
        </p>
        <a href={paint.source} target="_blank" rel="noreferrer">
          官方图片来源 <ArrowUpRight size={14} />
        </a>
      </div>
    </dialog>
  );
}
