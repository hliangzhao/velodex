import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, Heart, Trash2, Upload } from 'lucide-react';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { CompareButton, useLibrary } from './Library';
import { imageUrl } from './catalog';
import { paintsForBike } from './bikePaints';
import { mergeLibrary, parseLibrary, savedKey, type SavedBike } from './experience';
import type { Catalog } from './types';

const statuses = [
  { id: 'wanted', label: '想拥有' },
  { id: 'owned', label: '已拥有' },
  { id: 'liked', label: '只是喜欢' },
] as const;
export default function GaragePage() {
  usePageTitle('我的车库');
  return (
    <PageFrame active="garage">
      <CatalogContent>{(catalog) => <Garage catalog={catalog} />}</CatalogContent>
    </PageFrame>
  );
}

function Garage({ catalog }: { catalog: Catalog }) {
  const { library, update } = useLibrary();
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [removed, setRemoved] = useState<SavedBike>();
  const [backup, setBackup] = useState<{ url: string; name: string; content: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (backup) URL.revokeObjectURL(backup.url);
    },
    [backup],
  );
  const saved = library.saved.filter((item) => filter === 'all' || item.status === filter);
  const patch = (key: string, fields: Partial<Pick<SavedBike, 'status' | 'note'>>) =>
    update((prev) => ({
      ...prev,
      saved: prev.saved.map((item) => (savedKey(item) === key ? { ...item, ...fields } : item)),
    }));
  const exportGarage = () => {
    const content = JSON.stringify(library, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const name = `velodex-garage-${new Date().toISOString().slice(0, 10)}.json`;
    setBackup({ url, name, content });
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessage('车库备份已生成，包含收藏、涂装、笔记和当前对比。');
  };
  return (
    <>
      <header className="page-heading garage-heading">
        <div>
          <span className="eyebrow">A COLLECTION THAT FEELS LIKE YOU</span>
          <h1>给心动，留个位置。</h1>
          <p>一间小车库，收下你喜欢的每一款涂装。</p>
        </div>
        <div className="garage-count">
          <strong>{library.saved.length.toString().padStart(2, '0')}</strong>
          <span>私人收藏 / PERSONAL PICKS</span>
        </div>
      </header>
      <div className="garage-toolbar">
        <div className="garage-filters" role="group" aria-label="车库分类">
          {[{ id: 'all', label: '全部收藏' }, ...statuses].map((status) => (
            <button
              key={status.id}
              aria-pressed={filter === status.id}
              onClick={() => setFilter(status.id)}
            >
              {status.label}
              <small>
                {
                  library.saved.filter((item) => status.id === 'all' || item.status === status.id)
                    .length
                }
              </small>
            </button>
          ))}
        </div>
        <div className="garage-backup">
          <button onClick={exportGarage}>
            <Download size={15} />
            导出备份
          </button>
          <button onClick={() => fileInput.current?.click()}>
            <Upload size={15} />
            导入
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="导入车库备份文件"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                if (file.size > 2_000_000) throw new Error('文件过大，请选择小于 2 MB 的车库备份');
                const incoming = parseLibrary(await file.text());
                const valid = incoming.saved.filter((item) => {
                  const bike = catalog.bikes.find((b) => b.id === item.bikeId);
                  return bike && paintsForBike(bike).some((paint) => paint.id === item.paintId);
                });
                const skipped = incoming.saved.length - valid.length;
                update((current) => {
                  const next = mergeLibrary(current, {
                    ...incoming,
                    saved: valid,
                    comparison: incoming.comparison.filter((entry) =>
                      catalog.bikes.some(
                        (bike) =>
                          bike.id === entry.bikeId &&
                          bike.geometry.sizes.some((g) => g.size === entry.size),
                      ),
                    ),
                  });
                  setMessage(
                    `已导入 ${next.saved.length - current.saved.length} 条新收藏。已有收藏和笔记已保留。${skipped ? ` ${skipped} 条未知车型或涂装未导入。` : ''}`,
                  );
                  return next;
                });
              } catch (error) {
                setMessage(
                  `导入失败：${error instanceof Error ? error.message : '文件无法读取'}。现有车库未改动。`,
                );
              }
            }}
          />
        </div>
      </div>
      <p className="garage-local-note">
        无需账号，数据保存在当前浏览器。换设备或清理浏览器前，请导出备份；导入会合并新收藏并保留已有笔记。
      </p>
      {message && (
        <p className="garage-message" role="status">
          {message}
        </p>
      )}
      {backup && (
        <div className="backup-download">
          <a className="outline-button" href={backup.url} download={backup.name}>
            <Download size={15} />
            下载 JSON 备份
          </a>
          <details>
            <summary>浏览器未开始下载？查看备份文本</summary>
            <p>复制下方完整内容，保存为 .json 文件，即可通过“导入”恢复。</p>
            <textarea
              readOnly
              aria-label="车库备份文本"
              rows={8}
              value={backup.content}
              onFocus={(event) => event.target.select()}
            />
          </details>
        </div>
      )}
      {removed && (
        <div className="undo-banner" role="status">
          <span>已从车库移除这款涂装。</span>
          <button
            onClick={() => {
              update((prev) =>
                prev.saved.some((item) => savedKey(item) === savedKey(removed))
                  ? prev
                  : { ...prev, saved: [...prev.saved, removed] },
              );
              setRemoved(undefined);
            }}
          >
            撤销移除
          </button>
        </div>
      )}
      {saved.length ? (
        <div className="garage-grid">
          {saved.map((item) => {
            const key = savedKey(item);
            const bike = catalog.bikes.find((b) => b.id === item.bikeId);
            const paint = bike && paintsForBike(bike).find((p) => p.id === item.paintId);
            if (!bike || !paint)
              return (
                <article key={key} className="garage-card missing-saved">
                  <h2>暂未收录的收藏</h2>
                  <p>
                    {item.bikeId} / {item.paintId}
                  </p>
                  <p>{item.note}</p>
                  <button
                    className="outline-button"
                    onClick={() => {
                      setRemoved(item);
                      update((prev) => ({
                        ...prev,
                        saved: prev.saved.filter((s) => savedKey(s) !== key),
                      }));
                    }}
                  >
                    移除记录
                  </button>
                </article>
              );
            return (
              <article className="garage-card" key={key}>
                <div className="garage-card-top">
                  <span>{bike.brandId.toUpperCase()}</span>
                  <button
                    aria-label={`移除收藏 ${bike.family} ${paint.name}`}
                    onClick={() => {
                      setRemoved(item);
                      update((prev) => ({
                        ...prev,
                        saved: prev.saved.filter((s) => savedKey(s) !== key),
                      }));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <a href={`${base}?bike=${bike.id}&paint=${encodeURIComponent(paint.id)}`}>
                  <div
                    className={`garage-image ${paint.imageTone === 'dark' ? 'card-photo-dark' : ''}`}
                  >
                    <img
                      src={imageUrl(paint.image)}
                      alt={`${bike.family} · ${paint.name}`}
                      loading="lazy"
                    />
                  </div>
                  <h2>{bike.family}</h2>
                  <p className="garage-paint">
                    <i style={{ background: paint.hex }} />
                    {paint.name}
                  </p>
                </a>
                <div className="garage-card-controls">
                  <label>
                    <span className="sr-only">{bike.family} 收藏分类</span>
                    <select
                      aria-label={`${bike.family} 收藏分类`}
                      value={item.status}
                      onChange={(e) =>
                        patch(key, { status: e.target.value as SavedBike['status'] })
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <CompareButton bike={bike} />
                </div>
                <label className="garage-note-label">
                  心动的理由
                  <textarea
                    aria-label={`${bike.family} 私人笔记`}
                    value={item.note}
                    maxLength={1000}
                    rows={3}
                    placeholder="涂装、轮廓，或某次骑行的回忆……"
                    onChange={(e) => patch(key, { note: e.target.value })}
                  />
                  <span>自动保存在本机 · {item.note.length} / 1000</span>
                </label>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="garage-empty">
          <Heart size={38} strokeWidth={1} />
          <span className="eyebrow">ROOM FOR YOUR NEXT OBSESSION</span>
          <h2>{library.saved.length ? '这一栏，还空着。' : '第一台车，会是什么？'}</h2>
          <p>在图鉴里点击“收藏”，把喜欢的涂装带回来。</p>
          <a className="dark-button" href={`${base}?view=bikes`}>
            去图鉴逛逛 <ArrowRight size={17} />
          </a>
        </div>
      )}
    </>
  );
}
