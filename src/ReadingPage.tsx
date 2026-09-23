import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, Search } from 'lucide-react';
import data from './data/reading.json';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { imageUrl, loadParts } from './catalog';
import type { Catalog, PartsCatalog } from './types';
import { readingTopics, type ReadingArticle } from './reading';
import ReadingLabs from './ReadingLabs';
import './reading.css';

const articles = data.articles as ReadingArticle[];
const articleLink = (id: string) => `${base}?view=learn&article=${id}`;
const topicName = (id: string) => readingTopics.find(([key]) => key === id)?.[1] || id;
const symbols: Record<string, string> = {
  aero: 'v³',
  drivetrain: '52/11',
  rolling: '28 mm',
  frame: 'S / R',
  power: 'W/kg',
};

export default function ReadingPage() {
  const id = new URLSearchParams(location.search).get('article');
  const article = articles.find((a) => a.id === id);
  usePageTitle(article?.title || '赛场与骑行科学');
  return (
    <PageFrame active="stories">
      <CatalogContent>
        {(catalog) =>
          article ? (
            <Article key={article.id} article={article} catalog={catalog} />
          ) : (
            <ReadingIndex catalog={catalog} missing={Boolean(id)} />
          )
        }
      </CatalogContent>
    </PageFrame>
  );
}

function readFilters() {
  const params = new URLSearchParams(location.search);
  return {
    category: ['race', 'science'].includes(params.get('category') || '')
      ? params.get('category')!
      : 'all',
    topic: readingTopics.some(([id]) => id === params.get('topic')) ? params.get('topic')! : 'all',
    query: params.get('q') || '',
  };
}

function ReadingIndex({ catalog, missing }: { catalog: Catalog; missing: boolean }) {
  const [filters, setFilters] = useState(readFilters);
  useEffect(() => {
    const back = () => setFilters(readFilters());
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const update = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    const params = new URLSearchParams({ view: 'learn' });
    if (next.category !== 'all') params.set('category', next.category);
    if (next.topic !== 'all') params.set('topic', next.topic);
    if (next.query) params.set('q', next.query);
    history.replaceState(null, '', `${base}?${params}`);
  };
  const filtered = articles.filter(
    (a) =>
      (filters.category === 'all' || a.kind === filters.category) &&
      (filters.topic === 'all' || a.topic === filters.topic) &&
      `${a.title} ${a.dek} ${a.takeaway} ${a.kicker} ${a.sections.map((s) => [s.title, ...s.paragraphs, ...(s.rows?.flat() || []), s.formula || ''].join(' ')).join(' ')}`
        .toLowerCase()
        .includes(filters.query.trim().toLowerCase()),
  );
  return (
    <>
      <a className="back-link" href={`${base}?view=stories`}>
        <ArrowLeft size={15} />
        全部专题
      </a>
      <header className="reading-heading">
        <div>
          <span className="eyebrow">RACE NOTES & THE SCIENCE OF CYCLING</span>
          <h1>
            赛场器材
            <br />
            与骑行科学
          </h1>
          <p>
            从有出处的比赛配置和技术资料出发，了解空气动力学、齿比与轮胎等原理，也可以通过交互工具验证计算。
          </p>
        </div>
        <div className="reading-count">
          <strong>{String(articles.length).padStart(2, '0')}</strong>
          <span>
            {articles.filter((a) => a.kind === 'race').length} 篇赛场拆解 /{' '}
            {articles.filter((a) => a.kind === 'science').length} 篇科普
          </span>
          <small>每篇附来源、适用条件与相关工具</small>
        </div>
      </header>
      {missing && (
        <p className="reading-missing" role="status">
          这篇读本暂未收录，请从下方选择其他文章。
        </p>
      )}
      <div className="reading-filters">
        <div className="reading-kinds" role="group" aria-label="文章类型">
          {[
            ['all', '全部读本'],
            ['race', '赛场器材拆解'],
            ['science', '骑行科学'],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filters.category === id}
              onClick={() => update({ category: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="reading-search-row">
          <label>
            话题
            <select
              aria-label="筛选话题"
              value={filters.topic}
              onChange={(e) => update({ topic: e.target.value })}
            >
              {readingTopics.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="search">
            <Search size={17} />
            <input
              type="search"
              aria-label="搜索读本"
              placeholder="搜索车手、器材或知识点"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </label>
        </div>
      </div>
      <p className="reading-results" role="status">
        找到 {filtered.length} 篇 · 比赛案例按历史年份记录，非实时赛报
      </p>
      {filtered.length ? (
        <div className="reading-grid">
          {filtered.map((a) => (
            <ReadingCard key={a.id} article={a} catalog={catalog} />
          ))}
        </div>
      ) : (
        <div className="reading-empty">
          <h2>还没有匹配的读本</h2>
          <p>换个关键词，或回到全部话题继续逛。</p>
          <button
            className="dark-button"
            onClick={() => update({ category: 'all', topic: 'all', query: '' })}
          >
            重置筛选
          </button>
        </div>
      )}
    </>
  );
}

function ReadingCard({ article, catalog }: { article: ReadingArticle; catalog: Catalog }) {
  const bike = catalog.bikes.find((b) => b.id === article.heroBikeId);
  const image = article.image || bike?.image;
  return (
    <a className={`reading-card ${article.kind}`} href={articleLink(article.id)}>
      <div className={`reading-card-visual topic-${article.topic}`}>
        {image ? (
          <img
            src={imageUrl(image)}
            alt={
              article.image ? 'Deignan 的 2021 年鲁贝冠军车' : `${bike!.family} 零售版平台参考图`
            }
            loading="lazy"
          />
        ) : (
          <>
            <span className="science-symbol" aria-hidden="true">
              {article.id === 'lightweight-aero' ? 'kg ↔ W' : symbols[article.topic]}
            </span>
            <span className="science-grid" aria-hidden="true" />
          </>
        )}
        <small>
          {article.kind === 'race'
            ? article.image
              ? '官方赛后照片'
              : '零售版平台参考'
            : '原理 / 算例 / 小测'}
        </small>
      </div>
      <div className="reading-card-copy">
        <span className="eyebrow">{article.kicker}</span>
        <h2>{article.title}</h2>
        <p>{article.dek}</p>
        <div>
          <span>
            {topicName(article.topic)} · 约 {article.minutes} 分钟
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </div>
      </div>
    </a>
  );
}

function Article({ article, catalog }: { article: ReadingArticle; catalog: Catalog }) {
  const [parts, setParts] = useState<PartsCatalog>();
  const [partsFailed, setPartsFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const load = () => {
    setPartsFailed(false);
    loadParts()
      .then(setParts)
      .catch(() => setPartsFailed(true));
  };
  useEffect(() => {
    if (article.productIds.length) load();
  }, [article.id]);
  const sources = data.sources.filter((s) =>
    article.sections.some((section) => section.sourceIds.includes(s.id)),
  );
  const bike = catalog.bikes.find((b) => b.id === article.heroBikeId);
  const image = article.image || bike?.image;
  const share = async () => {
    try {
      await navigator.clipboard.writeText(new URL(articleLink(article.id), location.origin).href);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };
  return (
    <>
      <div className="reading-topline">
        <a className="back-link" href={`${base}?view=learn&category=${article.kind}`}>
          <ArrowLeft size={15} />
          {article.kind === 'race' ? '全部赛场拆解' : '全部骑行科学'}
        </a>
        <button className="quiet-action" onClick={share}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? '链接已复制' : '分享文章'}
        </button>
      </div>
      {copyFailed && (
        <label className="reading-copy-fallback">
          复制受限，可手动选择文章链接
          <input
            readOnly
            value={new URL(articleLink(article.id), location.origin).href}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
      <header className="reading-article-heading">
        <span className="eyebrow">{article.kicker}</span>
        <h1>{article.title}</h1>
        <p>{article.dek}</p>
        <div className="reading-meta">
          <span>{topicName(article.topic)}</span>
          <span>约 {article.minutes} 分钟</span>
          <span>资料核对 {article.checkedAt}</span>
        </div>
      </header>
      {image && (
        <figure className={`reading-hero-photo ${article.image ? 'race-photo' : ''}`}>
          <img src={imageUrl(image)} alt={article.heroCaption} fetchPriority="high" />
          <figcaption>
            {article.heroCaption}{' '}
            <a
              href={article.imageSource || bike!.imageSource || bike!.source}
              target="_blank"
              rel="noreferrer"
            >
              {article.image ? '照片出处' : `图片：${bike!.imageCredit}`} <ArrowUpRight size={12} />
            </a>
          </figcaption>
        </figure>
      )}
      <div className="reading-article-layout">
        <aside className="reading-toc">
          <span className="eyebrow">IN THIS NOTE</span>
          <nav aria-label="本文目录">
            {article.sections.map((s, i) => (
              <a href={`#${s.id}`} key={s.id}>
                <span>0{i + 1}</span>
                {s.title}
              </a>
            ))}
            {article.lab && (
              <a href="#try-it">
                <span>↗</span>动手试算
              </a>
            )}
            <a href="#quick-check">
              <span>?</span>一分钟自测
            </a>
            <a href="#reading-sources">
              <span>↗</span>来源与继续阅读
            </a>
          </nav>
        </aside>
        <article className="reading-body">
          <div className="reading-takeaway">
            <span className="eyebrow">内容提要</span>
            <p>{article.takeaway}</p>
          </div>
          {article.sections.map((s, i) => (
            <section id={s.id} className="reading-section" key={s.id}>
              <span className="eyebrow">
                0{i + 1} / {s.label}
              </span>
              <h2>{s.title}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.formula && <div className="reading-formula">{s.formula}</div>}
              {s.rows && (
                <dl className="reading-facts">
                  {s.rows.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.sourceIds.length > 0 && (
                <div className="reading-inline-sources">
                  依据：
                  {s.sourceIds.map((id) => {
                    const source = data.sources.find((item) => item.id === id)!;
                    return (
                      <a href={source.url} target="_blank" rel="noreferrer" key={id}>
                        {source.publisher} ↗
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
          {article.lab && <ReadingLabs type={article.lab} />}
          <p className="reading-boundary">
            <strong>怎样使用这篇内容</strong>
            {article.boundary}
          </p>
          <QuickCheck quiz={article.quiz} />
          <section className="reading-next">
            <span className="eyebrow">计算与对照</span>
            <h2>相关工具与图鉴</h2>
            {article.actions.map((action) => (
              <a className="dark-button" href={`${base}${action.search}`} key={action.search}>
                {action.label}
                <ArrowRight size={16} />
              </a>
            ))}
            {article.bikeIds.length > 0 && (
              <>
                <h3>相关图鉴 · 延伸比较用，非赛日配置</h3>
                <div className="reading-bike-links">
                  {article.bikeIds.map((id) => {
                    const b = catalog.bikes.find((item) => item.id === id)!;
                    return (
                      <a key={id} href={`${base}?bike=${id}`}>
                        <img src={imageUrl(b.image)} alt="" loading="lazy" />
                        <span>
                          {b.family}
                          <ArrowUpRight size={14} />
                        </span>
                      </a>
                    );
                  })}
                </div>
              </>
            )}
            {article.productIds.length > 0 && (
              <>
                <h3>相关配件 · 了解原理与规格</h3>
                <div className="reading-part-links">
                  {parts ? (
                    article.productIds.map((id) => (
                      <a key={id} href={`${base}?view=parts&product=${id}`}>
                        {parts.products.find((p) => p.id === id)!.name}
                        <ArrowUpRight size={14} />
                      </a>
                    ))
                  ) : partsFailed ? (
                    <button onClick={load}>配件信息读取失败，重试</button>
                  ) : (
                    <span role="status">正在读取配件档案…</span>
                  )}
                </div>
              </>
            )}
          </section>
          <section className="reading-sources" id="reading-sources">
            <span className="eyebrow">SOURCES / 可追溯的阅读</span>
            <h2>资料来源</h2>
            <p>原厂资料用于确认具体配置与设计说明；编辑算例不作为产品实测结果。</p>
            <ul>
              {sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                    <ArrowUpRight size={14} />
                  </a>
                  <small>核对于 {s.checkedAt}</small>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
      <section className="reading-related">
        <div className="editorial-heading">
          <h2>相关阅读</h2>
          <a href={`${base}?view=learn`} className="text-link">
            全部读本 <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="reading-grid">
          {article.relatedIds.map((id) => (
            <ReadingCard key={id} article={articles.find((a) => a.id === id)!} catalog={catalog} />
          ))}
        </div>
      </section>
    </>
  );
}

function QuickCheck({ quiz }: { quiz: ReadingArticle['quiz'] }) {
  const [chosen, setChosen] = useState<number>();
  return (
    <section className="reading-quiz" id="quick-check">
      <span className="eyebrow">ONE-MINUTE CHECK / 一分钟自测</span>
      <fieldset>
        <legend>{quiz.question}</legend>
        <div>
          {quiz.options.map((option, i) => (
            <button key={option} aria-pressed={chosen === i} onClick={() => setChosen(i)}>
              <span>{String.fromCharCode(65 + i)}</span>
              {option}
              {chosen === i && <Check size={16} />}
            </button>
          ))}
        </div>
      </fieldset>
      {chosen !== undefined && (
        <p className="quiz-explanation" role="status">
          <strong>
            {chosen === quiz.answer
              ? '答对了。'
              : `再想一下：正确答案是 ${String.fromCharCode(65 + quiz.answer)}。`}
          </strong>
          {quiz.explanation}
        </p>
      )}
    </section>
  );
}
