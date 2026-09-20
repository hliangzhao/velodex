import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Columns3, Search } from 'lucide-react';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { imageUrl } from './catalog';
import { comparisonSearch } from './experience';
import type { Catalog } from './types';
import dossier from './data/teams.json';
import './teams.css';

export default function TeamsPage() {
  usePageTitle('车队档案');
  return (
    <PageFrame active="teams">
      <CatalogContent>{(catalog) => <Teams catalog={catalog} />}</CatalogContent>
    </PageFrame>
  );
}

function Teams({ catalog }: { catalog: Catalog }) {
  const initial = new URLSearchParams(location.search).get('team') || 'all';
  const [teamId, setTeamId] = useState(
    dossier.teams.some((t) => t.id === initial) ? initial : 'all',
  );
  const [query, setQuery] = useState('');
  useEffect(() => {
    const back = () => {
      const id = new URLSearchParams(location.search).get('team');
      setTeamId(dossier.teams.some((t) => t.id === id) ? id! : 'all');
      setQuery('');
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const select = (id: string) => {
    setTeamId(id);
    setQuery('');
    const params = new URLSearchParams({ view: 'teams' });
    if (id !== 'all') params.set('team', id);
    history.pushState(null, '', `${base}?${params}`);
  };
  const filtered = dossier.teams.filter((t) => {
    const brand = catalog.brands.find((b) => b.id === t.brandId)!;
    return (
      (teamId === 'all' || t.id === teamId) &&
      `${t.name} ${t.alias} ${brand.name}`.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
  return (
    <>
      <header className="teams-hero">
        <div>
          <span className="eyebrow">INSIDE THE PELOTON / {dossier.season}</span>
          <h1>
            跟着车队，
            <br />
            读懂赛车<span>。</span>
          </h1>
          <p>
            一支车队，一条认识器材的路线。
            <br />
            从赛场上的合作关系，看到车架、配置和设计取舍。
          </p>
        </div>
        <div className="teams-hero-number">
          <strong>06</strong>
          <span>TEAMS / 本期六支车队</span>
          <small>资料核对 {dossier.checkedAt}</small>
        </div>
      </header>
      <div className="teams-filter">
        <div role="group" aria-label="选择车队">
          <button aria-pressed={teamId === 'all'} onClick={() => select('all')}>
            全部车队
          </button>
          {dossier.teams.map((t) => (
            <button key={t.id} aria-pressed={teamId === t.id} onClick={() => select(t.id)}>
              {t.short}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            type="search"
            aria-label="搜索车队或品牌"
            placeholder="车队、品牌或中文名"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="teams-scope">
        本期关注男子职业公路车队，按官方赛季公告记录。下方照片与参数来自站内收录的零售车型，车手实际用车的涂装、尺码和部件可能不同。
      </p>
      <div className="teams-count" role="status">
        {filtered.length} 支车队
      </div>
      <div className="teams-grid">
        {filtered.map((t) => {
          const bikes = t.bikeIds.map((id) => catalog.bikes.find((b) => b.id === id)!);
          const hero = catalog.bikes.find((b) => b.id === t.heroBikeId)!;
          const brand = catalog.brands.find((b) => b.id === t.brandId)!;
          return (
            <article
              key={t.id}
              id={`team-${t.id}`}
              className="team-card"
              style={{ '--team-color': t.accent } as CSSProperties}
            >
              <div className="team-card-top">
                <span>
                  {t.short} / {dossier.season}
                </span>
                <a href={`${base}?view=teams&team=${t.id}`} aria-label={`打开 ${t.name} 档案`}>
                  <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="team-intro">
                <small>{brand.name}</small>
                <h2>{t.name}</h2>
                <p>{t.headline}</p>
              </div>
              <a className="team-bike-photo" href={`${base}?bike=${hero.id}`}>
                <img src={imageUrl(hero.image)} alt={`${hero.name} 零售版参考图`} loading="lazy" />
                <span>
                  图鉴参考 / {hero.family} · 零售版 <ArrowRight size={14} />
                </span>
              </a>
              <div className="team-body">
                <p>{t.description}</p>
                <dl>
                  {t.equipment.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="team-look">
                  <span className="eyebrow">WHAT TO LOOK FOR</span>
                  <h3>值得细看的地方</h3>
                  <p>{t.lookFor}</p>
                </div>
                <div className="team-bike-links">
                  <span>品牌图鉴延伸</span>
                  {bikes.map((b) => (
                    <a key={b.id} href={`${base}?bike=${b.id}`}>
                      {b.family}
                      <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
                {bikes.length > 1 && (
                  <a
                    className="text-link team-compare"
                    href={`${base}${comparisonSearch(bikes.map((b) => ({ bikeId: b.id, size: b.geometry.defaultSize })))}`}
                  >
                    <Columns3 size={16} /> 对比这些图鉴车型 <ArrowRight size={15} />
                  </a>
                )}
                <div className="team-sources">
                  {t.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={28} />
          <h2>没有匹配的车队</h2>
          <button className="outline-button" onClick={() => select('all')}>
            清除筛选
          </button>
        </div>
      )}
      <div className="team-footnote">
        <p>车队装备会随赛季、赛道和车手改变。这里保留来源和时间，不以赞助关系推断器材性能。</p>
        <a className="text-link" href={`${base}?view=feedback`}>
          补充车队资料或纠错 <ArrowUpRight size={15} />
        </a>
      </div>
    </>
  );
}
