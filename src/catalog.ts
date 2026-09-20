import type { Catalog, PartsCatalog } from './types';

export async function loadCatalog(): Promise<Catalog> {
  if (import.meta.env.MODE === 'pages') {
    // Pages publishes the same source data as a versioned, static build asset.
    const { default: catalog } = await import('../server/data/catalog.json');
    return catalog as Catalog;
  }
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('无法读取车型资料');
  return response.json();
}

export async function loadParts(): Promise<PartsCatalog> {
  if (import.meta.env.MODE === 'pages') {
    const { default: parts } = await import('../server/data/parts.json');
    return parts as PartsCatalog;
  }
  const response = await fetch('/api/parts');
  if (!response.ok) throw new Error('无法读取配件资料');
  return response.json();
}

export function imageUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
