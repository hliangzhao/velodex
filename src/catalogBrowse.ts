import type { Bike, Brand, Collection } from './types';

export type CatalogFilters = {
  brand: string;
  year: string;
  kind: string;
  collection: Collection;
  query: string;
};
export const yearLabel = (bike: Bike) => (bike.modelYear ? `${bike.modelYear}` : '年份未标注');

export function filterBikes(bikes: Bike[], brands: Brand[], filters: CatalogFilters) {
  const query = filters.query.trim().toLowerCase();
  return bikes.filter(
    (bike) =>
      (filters.brand === 'all' || bike.brandId === filters.brand) &&
      (filters.year === 'all' ||
        (filters.year === 'unknown' ? !bike.modelYear : String(bike.modelYear) === filters.year)) &&
      (filters.kind === 'all' || bike.kind === filters.kind) &&
      (filters.collection === 'all' || bike.collections.includes(filters.collection)) &&
      `${bike.name} ${bike.brandId} ${brands.find((b) => b.id === bike.brandId)?.name ?? ''} ${bike.build} ${bike.modelYear ?? ''} ${bike.edition} ${bike.color} ${(bike.paints ?? []).map((paint) => paint.name).join(' ')}`
        .toLowerCase()
        .includes(query),
  );
}

export function groupBikes(bikes: Bike[], brands: Brand[], mode: 'brand' | 'year') {
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
  const groups = new Map<string, Bike[]>();
  for (const bike of bikes) {
    const key = mode === 'brand' ? bike.brandId : String(bike.modelYear ?? 'unknown');
    groups.set(key, [...(groups.get(key) ?? []), bike]);
  }
  return [...groups]
    .sort(([a], [b]) =>
      mode === 'brand'
        ? brandName(a).localeCompare(brandName(b), 'en')
        : (Number(b) || 0) - (Number(a) || 0),
    )
    .map(([id, items]) => ({
      id,
      title: mode === 'brand' ? brandName(id) : id === 'unknown' ? '年份未标注' : `${id} 年`,
      subtitle:
        mode === 'brand'
          ? brands.find((b) => b.id === id)?.country
          : id === 'unknown'
            ? '保留官方产品编号与地区版本'
            : '收录配置的车型年份',
      bikes: items.sort((a, b) =>
        mode === 'brand'
          ? (b.modelYear ?? 0) - (a.modelYear ?? 0) || a.name.localeCompare(b.name, 'en')
          : brandName(a.brandId).localeCompare(brandName(b.brandId), 'en') ||
            a.name.localeCompare(b.name, 'en'),
      ),
    }));
}
