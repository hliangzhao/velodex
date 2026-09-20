import type { Bike, GeometrySize } from './types';

export type SavedBike = {
  bikeId: string;
  paintId: string;
  status: 'wanted' | 'owned' | 'liked';
  note: string;
};
export type ComparisonEntry = { bikeId: string; size: string };
export type Library = { version: 1; saved: SavedBike[]; comparison: ComparisonEntry[] };
export const emptyLibrary = (): Library => ({ version: 1, saved: [], comparison: [] });
export const savedKey = (item: Pick<SavedBike, 'bikeId' | 'paintId'>) =>
  `${item.bikeId}:${item.paintId}`;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value);

// Validate before replacing any local data, including backups from another browser.
export function parseLibrary(raw: string): Library {
  const value = JSON.parse(raw);
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.saved) ||
    !Array.isArray(value.comparison) ||
    value.saved.length > 500 ||
    value.comparison.length > 3
  )
    throw new Error('不支持的车库文件格式');
  const keys = new Set<string>();
  const saved = value.saved.map((item: SavedBike) => {
    if (
      !item ||
      !identifier(item.bikeId) ||
      !identifier(item.paintId) ||
      !['wanted', 'owned', 'liked'].includes(item.status) ||
      typeof item.note !== 'string' ||
      item.note.length > 1000 ||
      keys.has(savedKey(item))
    )
      throw new Error('收藏记录有误');
    keys.add(savedKey(item));
    return { bikeId: item.bikeId, paintId: item.paintId, status: item.status, note: item.note };
  });
  const ids = new Set<string>();
  const comparison = value.comparison.map((item: ComparisonEntry) => {
    if (
      !item ||
      !identifier(item.bikeId) ||
      typeof item.size !== 'string' ||
      item.size.length > 30 ||
      ids.has(item.bikeId)
    )
      throw new Error('对比记录有误');
    ids.add(item.bikeId);
    return { bikeId: item.bikeId, size: item.size };
  });
  return { version: 1, saved, comparison };
}

export function mergeLibrary(current: Library, incoming: Library): Library {
  const keys = new Set(current.saved.map(savedKey));
  const saved = [...current.saved, ...incoming.saved.filter((item) => !keys.has(savedKey(item)))];
  if (saved.length > 500) throw new Error('车库最多保存 500 个涂装条目');
  return {
    version: 1,
    saved,
    comparison: current.comparison.length ? current.comparison : incoming.comparison,
  };
}

export function geometryFor(bike: Bike, size?: string): GeometrySize | undefined {
  return (
    bike.geometry.sizes.find((g) => g.size === size) ||
    bike.geometry.sizes.find((g) => g.size === bike.geometry.defaultSize) ||
    bike.geometry.sizes[0]
  );
}

export function resolveComparison(entries: ComparisonEntry[], bikes: Bike[]) {
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const bike = bikes.find((b) => b.id === entry.bikeId);
    if (!bike || seen.has(bike.id) || seen.size >= 3) return [];
    seen.add(bike.id);
    return [{ bikeId: bike.id, size: geometryFor(bike, entry.size)?.size || '' }];
  });
}

export function comparisonFromSearch(search: string, bikes: Bike[]) {
  const params = new URLSearchParams(search);
  const sizes = (params.get('sizes') || '').split(',');
  return resolveComparison(
    (params.get('bikes') || '').split(',').map((bikeId, i) => ({ bikeId, size: sizes[i] || '' })),
    bikes,
  );
}

export function comparisonSearch(entries: ComparisonEntry[]) {
  const params = new URLSearchParams({
    view: 'compare',
    bikes: entries.map((e) => e.bikeId).join(','),
    sizes: entries.map((e) => e.size).join(','),
  });
  return `?${params}`;
}

export function geometryPoints(g: GeometrySize) {
  const radians = Math.PI / 180;
  const rear = { x: -Math.sqrt(g.chainstay ** 2 - g.bbDrop ** 2), y: -g.bbDrop };
  const headTop = { x: g.reach, y: -g.stack };
  const headBottom = {
    x: g.reach + Math.cos(g.headAngle * radians) * g.headTube,
    y: -g.stack + Math.sin(g.headAngle * radians) * g.headTube,
  };
  const seat = {
    x: -Math.cos(g.seatAngle * radians) * (g.seatTube ?? 500),
    y: -Math.sin(g.seatAngle * radians) * (g.seatTube ?? 500),
  };
  // Never infer an unpublished front axle or seat-tube length as a measured point.
  return {
    rear,
    headTop,
    headBottom,
    seat,
    seatMeasured: g.seatTube != null,
    front: g.wheelbase == null ? null : { x: rear.x + g.wheelbase, y: rear.y },
  };
}
