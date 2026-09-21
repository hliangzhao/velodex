import { useEffect, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { imageUrl } from './catalog';
import type { Catalog } from './types';
import dossier from './data/riders.json';
import teams from './data/teams.json';
import PelotonNav from './PelotonNav';
import './teams.css';
import './riders.css';

export default function RidersPage() {
  usePageTitle('车手焦点');
  return (
    <PageFrame active="teams">
      <CatalogContent>{(catalog) => <Riders catalog={catalog} />}</CatalogContent>
    </PageFrame>
  );
}

function Riders({ catalog }: { catalog: Catalog }) {
  const fromUrl = () => {
    const p = new URLSearchParams(location.search);
    return { rider: p.get('rider') || '', team: p.get('team') || 'all' };
  };
  const [selection, setSelection] = useState(fromUrl);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  useEffect(() => {
    const back = () => {
      setSelection(fromUrl());
      setQuery('');
      setRole('all');
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const pickTeam = (id: string) => {
    setSelection({ rider: '', team: id });
    const params = new URLSearchParams({ view: 'riders' });
    if (id !== 'all') params.set('team', id);
    history.pushState(null, '', `${base}?${params}`);
  };
  const reset = () => {
    pickTeam('all');
    setQuery('');
    setRole('all');
  };
  const filtered = dossier.riders.filter((r) => {
    const team = teams.teams.find((t) => t.id === r.teamId)!;
    return (
      (!selection.rider || r.id === selection.rider) &&
      (selection.team === 'all' || r.teamId === selection.team) &&
      (role === 'all' || r.tags.includes(role)) &&
      `${r.name} ${r.english} ${r.aliases.join(' ')} ${r.country} ${r.tags.join(' ')} ${team.name} ${team.alias}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  return (
    <>
      <PelotonNav active="riders" />
      <header className="riders-hero">
        <div>
          <span className="eyebrow">RIDERS IN FOCUS / {dossier.season}</span>
          <h1>
            让赛车有故事的，
            <br />
            是骑车的人<span>。</span>
          </h1>
          <p>认识一个人，也多一种看比赛的方式。</p>
        </div>
        <div className="riders-hero-index">
          <strong>{String(dossier.riders.length).padStart(2, '0')}</strong>
          <span>个名字，许多种骑法</span>
          <small>资料核对 {dossier.checkedAt}</small>
        </div>
      </header>
      <p className="teams-scope">
        {dossier.scope} 近期记录保留事件日期，不是实时战报。历史照片注明拍摄年份，所属车队按{' '}
        {dossier.season} 赛季展示。
      </p>
      <div className="riders-filters">
        <label className="search">
          <Search size={17} />
          <input
            type="search"
            aria-label="搜索车手"
            placeholder="波加查、Remco、国家或车队"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          车队
          <select value={selection.team} onChange={(e) => pickTeam(e.target.value)}>
            <option value="all">全部车队</option>
            {teams.teams
              .filter((t) => dossier.riders.some((r) => r.teamId === t.id))
              .map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          比赛特点
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">全部特点</option>
            {[...new Set(dossier.riders.flatMap((r) => r.tags))].map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </label>
        {(selection.rider || selection.team !== 'all' || role !== 'all' || query) && (
          <button className="text-link" onClick={reset}>
            查看全部车手
          </button>
        )}
      </div>
      <p className="teams-count" role="status">
        {filtered.length} 位车手
      </p>
      <div className="riders-grid">
        {filtered.map((r) => {
          const team = teams.teams.find((t) => t.id === r.teamId)!;
          return (
            <article className="rider-card" key={r.id} id={`rider-${r.id}`}>
              <div className="rider-card-head">
                <span>
                  {r.country} / {dossier.season}
                </span>
                <a
                  href={`${base}?view=riders&rider=${r.id}`}
                  aria-label={`打开 ${r.name} 的独立链接`}
                >
                  <ArrowUpRight size={18} />
                </a>
              </div>
              <figure className="rider-portrait">
                <a
                  href={r.photo.source}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${r.name} 照片原始出处`}
                >
                  <img
                    src={imageUrl(r.photo.image)}
                    alt={`${r.name} · ${r.photo.caption}`}
                    loading="lazy"
                  />
                </a>
                <figcaption>
                  {r.photo.caption}
                  <br />
                  <span>摄影：{r.photo.author} · </span>
                  <a href={r.photo.source} target="_blank" rel="noreferrer">
                    原图
                  </a>{' '}
                  ·{' '}
                  <a href={r.photo.licenseUrl} target="_blank" rel="noreferrer">
                    {r.photo.license}
                  </a>
                </figcaption>
              </figure>
              <div className="rider-copy">
                <span className="rider-english">{r.english}</span>
                <h2>{r.name}</h2>
                <a className="rider-team" href={`${base}?view=teams&team=${team.id}`}>
                  {team.name} <ArrowUpRight size={13} />
                </a>
                <div className="rider-tags">
                  {r.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <h3>{r.title}</h3>
                <p>{r.intro}</p>
                <div className="rider-watch">
                  <small>下次看比赛，留意这一点</small>
                  <p>{r.watch}</p>
                </div>
                <div className="rider-recent">
                  <small>近期记录 / {r.recent.date}</small>
                  <p>{r.recent.text}</p>
                  <a href={r.recent.source} target="_blank" rel="noreferrer">
                    读官方记录 ↗
                  </a>
                </div>
                <div className="rider-bikes">
                  <small>关联品牌图鉴 · 零售配置参考</small>
                  {r.bikeIds.map((id) => {
                    const b = catalog.bikes.find((b) => b.id === id)!;
                    return (
                      <a key={id} href={`${base}?bike=${id}`}>
                        {b.family} <ArrowUpRight size={13} />
                      </a>
                    );
                  })}
                </div>
                <a className="text-link" href={r.profile} target="_blank" rel="noreferrer">
                  车队资料与报道 <ArrowUpRight size={14} />
                </a>
                <details className="rider-license">
                  <summary>照片署名与使用许可</summary>
                  <p>
                    《{r.photo.title}》 · {r.photo.author} / Wikimedia Commons。{r.photo.changes}
                  </p>
                  <p>图片许可不表示车手或摄影者为本站背书；本条目用于人物介绍与比赛评论。</p>
                </details>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <h2>没有匹配的车手</h2>
          <button className="outline-button" onClick={reset}>
            清除筛选
          </button>
        </div>
      )}
      <div className="team-footnote">
        <p>
          器材关联用于延伸阅读，零售车型不等于车手的赛日装配。照片各自保留其许可；本页不提供未经证实的个人
          FTP、体重或功率估计。
        </p>
        <a className="text-link" href={`${base}?view=feedback`}>
          补充资料或纠错 <ArrowUpRight size={15} />
        </a>
      </div>
    </>
  );
}
