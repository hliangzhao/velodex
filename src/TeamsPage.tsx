import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Columns3, Search } from 'lucide-react';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { imageUrl } from './catalog';
import { comparisonSearch } from './experience';
import type { Catalog } from './types';
import dossier from './data/teams.json';
import riderDossier from './data/riders.json';
import PelotonNav from './PelotonNav';
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
  const [division, setDivision] = useState('all');
  useEffect(() => {
    const back = () => {
      const id = new URLSearchParams(location.search).get('team');
      setTeamId(dossier.teams.some((t) => t.id === id) ? id! : 'all');
      setQuery('');
      setDivision('all');
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
      (division === 'all' || t.division === division) &&
      `${t.name} ${t.alias} ${brand.name}`.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
  return (
    <>
      <PelotonNav active="teams" />
      <header className="teams-hero">
        <div>
          <span className="eyebrow">INSIDE THE PELOTON / {dossier.season}</span>
          <h1>
            职业车队
            <br />
            与赛场器材
          </h1>
          <p>查看车队的用车平台、器材合作与公开装配资料，了解不同赛道上的配置选择。</p>
        </div>
        <div className="teams-hero-number">
          <strong>{String(dossier.teams.length).padStart(2, '0')}</strong>
          <span>TEAMS / 本期 {dossier.teams.length} 支车队</span>
          <small>最近补充 {dossier.checkedAt}</small>
        </div>
      </header>
      <div className="teams-filter">
        <label className="peloton-division">
          组别
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              select('all');
            }}
          >
            <option value="all">全部组别</option>
            <option value="men">男子车队</option>
            <option value="women">女子车队</option>
          </select>
        </label>
        <div role="group" aria-label="选择车队">
          <button aria-pressed={teamId === 'all'} onClick={() => select('all')}>
            全部车队
          </button>
          {dossier.teams
            .filter((t) => division === 'all' || t.division === division)
            .map((t) => (
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
        本期收录男子与女子职业公路车队，按官方公告与器材页面记录。下方照片与参数来自站内零售车型，具体代际与赛日装配差异见各队说明。
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
                  {t.short} / {t.division === 'women' ? '女子' : '男子'} / {dossier.season}
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
                  <h3>器材特点</h3>
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
                  <span>核对于 {t.checkedAt}</span>
                  {t.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                </div>
                {riderDossier.riders.some((r) => r.teamId === t.id) && (
                  <div className="team-riders">
                    <span>认识车手</span>
                    {riderDossier.riders
                      .filter((r) => r.teamId === t.id)
                      .map((r) => (
                        <a key={r.id} href={`${base}?view=riders&rider=${r.id}`}>
                          {r.name} ↗
                        </a>
                      ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={28} />
          <h2>没有匹配的车队</h2>
          <button
            className="outline-button"
            onClick={() => {
              select('all');
              setDivision('all');
            }}
          >
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
