import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalogPath = new URL('./data/catalog.json', import.meta.url);
export function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, 'utf8'));
}
export function createApp(catalog = loadCatalog(), { production = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/catalog', (_req, res) => res.json(catalog));
  app.get('/api/brands', (_req, res) => res.json(catalog.brands));
  app.get('/api/bikes', (req, res) => {
    const { brand, collection, kind, q } = req.query;
    if (
      [brand, collection, kind, q].some((value) => value !== undefined && typeof value !== 'string')
    )
      return res.status(400).json({ error: '筛选参数必须是字符串' });
    if (collection && !['all', 'current', 'classic', 'popular'].includes(collection))
      return res.status(400).json({ error: '不支持的车型分类' });
    const query = q?.trim().toLowerCase();
    const brandNames = new Map(catalog.brands.map((item) => [item.id, item.name]));
    const bikes = catalog.bikes.filter(
      (bike) =>
        (!brand || bike.brandId === brand) &&
        (!kind || kind === 'all' || bike.kind === kind) &&
        (!collection || collection === 'all' || bike.collections.includes(collection)) &&
        (!query ||
          `${bike.name} ${bike.brandId} ${brandNames.get(bike.brandId) ?? ''} ${bike.build}`
            .toLowerCase()
            .includes(query)),
    );
    res.json({ bikes, total: bikes.length });
  });
  app.get('/api/bikes/:id', (req, res) => {
    const bike = catalog.bikes.find((item) => item.id === req.params.id);
    return bike ? res.json(bike) : res.status(404).json({ error: '未找到车型' });
  });
  app.get('/api/bikes/:id/components/:component', (req, res) => {
    const bike = catalog.bikes.find((item) => item.id === req.params.id);
    const part = bike?.components.find((item) => item.id === req.params.component);
    return part ? res.json(part) : res.status(404).json({ error: '未找到部件' });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
  if (production) {
    const dist = fileURLToPath(new URL('../dist', import.meta.url));
    app.use(express.static(dist));
    app.get('/', (_req, res) => res.sendFile(`${dist}/index.html`));
  }
  app.use((_req, res) => res.status(404).json({ error: '页面不存在' }));
  return app;
}
