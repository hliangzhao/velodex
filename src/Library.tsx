import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Heart, Check, Plus, Columns3 } from 'lucide-react';
import type { Bike } from './types';
import {
  emptyLibrary,
  parseLibrary,
  savedKey,
  type Library,
  type SavedBike,
  type ComparisonEntry,
} from './experience';

const STORAGE_KEY = 'velodex.library.v1';
type LibraryContext = {
  library: Library;
  update: (fn: (previous: Library) => Library) => void;
  setComparison: (entries: ComparisonEntry[]) => void;
  storageError: string;
};
const Context = createContext<LibraryContext | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return { library: raw ? parseLibrary(raw) : emptyLibrary(), error: '' };
    } catch {
      return {
        library: emptyLibrary(),
        error: '无法读取本地车库，当前收藏仅在本次访问中保留。可在车库导出备份。',
      };
    }
  });
  const [library, setLibrary] = useState(initial.library);
  const currentLibrary = useRef(initial.library);
  const [storageError, setStorageError] = useState(initial.error);
  // Event handlers persist exactly the state they publish; no write during rendering.
  const update = (fn: (previous: Library) => Library) => {
    const next = fn(currentLibrary.current);
    try {
      // Do not overwrite an unreadable previous garage with an empty fallback.
      if (initial.error) throw new Error('Previous garage could not be read');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError('');
    } catch {
      setStorageError('浏览器未能保存车库，刷新可能丢失更改。请在车库导出备份。');
    }
    currentLibrary.current = next;
    setLibrary(next);
  };
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        const next = event.newValue ? parseLibrary(event.newValue) : emptyLibrary();
        currentLibrary.current = next;
        setLibrary(next);
        setStorageError('');
      } catch {
        setStorageError('另一个标签页的车库数据无法读取，已保留当前记录。');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return (
    <Context.Provider
      value={{
        library,
        update,
        storageError,
        setComparison: (comparison) => update((prev) => ({ ...prev, comparison })),
      }}
    >
      {storageError && (
        <div className="storage-notice" role="status">
          {storageError}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function useLibrary() {
  const context = useContext(Context);
  if (!context) throw new Error('LibraryProvider missing');
  return context;
}

export function SaveButton({ bike, paintId = 'default' }: { bike: Bike; paintId?: string }) {
  const { library, update } = useLibrary();
  const key = savedKey({ bikeId: bike.id, paintId });
  const saved = library.saved.some((item) => savedKey(item) === key);
  if (saved)
    return (
      <a
        className="quiet-action saved"
        href={`${import.meta.env.BASE_URL}?view=garage`}
        aria-label={`${bike.family} 已收藏，前往车库`}
      >
        <Heart size={15} fill="currentColor" />
        已收藏
      </a>
    );
  return (
    <button
      className="quiet-action"
      disabled={library.saved.length >= 500}
      onClick={() =>
        update((previous) =>
          previous.saved.some((item) => savedKey(item) === key) || previous.saved.length >= 500
            ? previous
            : {
                ...previous,
                saved: [
                  ...previous.saved,
                  { bikeId: bike.id, paintId, status: 'wanted', note: '' } satisfies SavedBike,
                ],
              },
        )
      }
      aria-label={`收藏 ${bike.family} 当前涂装`}
    >
      <Heart size={15} />
      收藏
    </button>
  );
}

export function CompareButton({ bike }: { bike: Bike }) {
  const { library, setComparison } = useLibrary();
  const selected = library.comparison.some((item) => item.bikeId === bike.id);
  const full = !selected && library.comparison.length >= 3;
  return (
    <button
      className="quiet-action"
      aria-pressed={selected}
      disabled={full}
      title={full ? '已选满三款，请先移除一款' : undefined}
      aria-label={`${selected ? '移除对比' : '加入对比'} ${bike.family}`}
      onClick={() =>
        setComparison(
          selected
            ? library.comparison.filter((item) => item.bikeId !== bike.id)
            : [...library.comparison, { bikeId: bike.id, size: bike.geometry.defaultSize }],
        )
      }
    >
      {selected ? <Check size={15} /> : <Plus size={15} />}
      {full ? '对比已满' : '对比'}
    </button>
  );
}

export function CompareDock() {
  const { library } = useLibrary();
  if (!library.comparison.length) return null;
  return (
    <a className="compare-dock" href={`${import.meta.env.BASE_URL}?view=compare`}>
      <Columns3 size={17} />
      整车对比 <span>{library.comparison.length} / 3</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
