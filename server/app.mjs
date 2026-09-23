import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalogPath = new URL('./data/catalog.json', import.meta.url);
export function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, 'utf8'));
}
export function loadParts() {
  return JSON.parse(readFileSync(new URL('./data/parts.json', import.meta.url), 'utf8'));
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
  app.get('/api/rider-stories', (_req, res) => {
    try {
      res.json(
        JSON.parse(readFileSync(new URL('../public/rider-stories.json', import.meta.url), 'utf8')),
      );
    } catch {
      res.status(503).json({ error: '故事快照暂不可用' });
    }
  });
  const parts = loadParts();
  app.get('/api/parts', (req, res) => {
    const { category, brand, q } = req.query;
    if ([category, brand, q].some((value) => value !== undefined && typeof value !== 'string'))
      return res.status(400).json({ error: '筛选参数必须是字符串' });
    if (
      category &&
      !['all', 'wheels', 'groupsets', 'tires', 'handlebars', 'seatposts', 'saddles'].includes(
        category,
      )
    )
      return res.status(400).json({ error: '不支持的配件分类' });
    const query = q?.trim().toLowerCase();
    const products = parts.products.filter(
      (p) =>
        (!category || category === 'all' || p.category === category) &&
        (!brand || brand === 'all' || p.brandId === brand) &&
        (!query ||
          `${p.name} ${p.brandId} ${parts.brands.find((b) => b.id === p.brandId)?.name}`
            .toLowerCase()
            .includes(query)),
    );
    res.json({ ...parts, products, total: products.length });
  });
  app.get('/api/parts/:id', (req, res) => {
    const product = parts.products.find((p) => p.id === req.params.id);
    return product ? res.json(product) : res.status(404).json({ error: '未找到配件' });
  });
  app.get('/api/bikes', (req, res) => {
    const { brand, collection, kind, q } = req.query;
    if (
      [brand, collection, kind, q].some((value) => value !== undefined && typeof value !== 'string')
    )
      return res.status(400).json({ error: '筛选参数必须是字符串' });
    if (
      collection &&
      !['all', 'current', 'classic', 'popular', 'pro', 'flagship'].includes(collection)
    )
      return res.status(400).json({ error: '不支持的车型分类' });
    const query = q?.trim().toLowerCase();
    const brandNames = new Map(catalog.brands.map((item) => [item.id, item.name]));
    const bikes = catalog.bikes.filter(
      (bike) =>
        (!brand || bike.brandId === brand) &&
        (!kind || kind === 'all' || bike.kind === kind) &&
        (!collection || collection === 'all' || bike.collections.includes(collection)) &&
        (!query ||
          `${bike.name} ${bike.brandId} ${brandNames.get(bike.brandId) ?? ''} ${bike.build} ${bike.modelYear ?? ''} ${bike.edition} ${bike.color} ${(bike.paints ?? []).map((paint) => paint.name).join(' ')}`
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
