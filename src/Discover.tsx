import { ArrowRight, ArrowUpRight, Shuffle, Columns3 } from 'lucide-react';
import type { Catalog } from './types';
import { imageUrl } from './catalog';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { comparisonSearch } from './experience';
import BikeCard from './BikeCard';
import stories from './data/stories.json';
import { SaveButton } from './Library';
import './workshop.css';
import './community.css';

export function StoryCards({ catalog, limit }: { catalog: Catalog; limit?: number }) {
  return (
    <div className="story-grid">
      {(limit ? stories.slice(-limit) : stories).map((story) => {
        const bike = catalog.bikes.find((b) => b.id === story.hero)!;
        return (
          <a className="story-card" href={`${base}?view=stories&story=${story.id}`} key={story.id}>
            <div className="story-image">
              <span>{story.number}</span>
              <img src={imageUrl(bike.image)} alt={bike.family} loading="lazy" />
            </div>
            <div className="story-card-copy">
              <span className="eyebrow">{story.tag}</span>
              <h3>{story.title}</h3>
              <p>{story.subtitle}</p>
              <span className="text-link">
                打开专题 <ArrowUpRight size={16} />
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default function Discover() {
  usePageTitle('发现');
  return (
    <PageFrame active="discover">
      <CatalogContent>
        {(catalog) => {
          const feature = catalog.bikes.find((b) => b.id === 'sworks-venge')!;
          const picks = [
            'aethos-expert',
            'aethos2-expert',
            'scott-addict-rc10',
            'allez-sprint-comp',
          ].map((id) => catalog.bikes.find((b) => b.id === id)!);
          return (
            <>
              <div className="work-banner">
                <div>
                  <span className="eyebrow">NEW / 骑友工坊</span>
                  <h2>你的梦幻装车单，值得一张海报。</h2>
                  <p>选车型、配件与涂装，算齿比，拆开结构，把心动分享出去。</p>
                </div>
                <a href={`${base}?view=workshop`}>开始装车 ↗</a>
              </div>
              <div className="discovery-overline">
                <span>
                  <i /> A FIELD GUIDE TO ROAD OBSESSION
                </span>
                <span>
                  {catalog.brands.length} 个品牌 / {catalog.bikes.length} 款车 / 无数种热爱
                </span>
              </div>
              <section className="discovery-hero">
                <div className="discovery-copy">
                  <span className="eyebrow">骑行结束，好奇继续。</span>
                  <h1>
                    总有一台车，
                    <br />
                    让你多看一眼<span>。</span>
                  </h1>
                  <p>
                    看轮廓，也看门道。
                    <br />
                    从经典世代到新的设计，慢慢逛，仔细看，
                    <br className="desktop-break" />
                    留一间属于自己的车库。
                  </p>
                  <a className="dark-button" href={`${base}?view=bikes`}>
                    进入整车图鉴 <ArrowRight size={18} />
                  </a>
                  <button
                    className="random-bike"
                    onClick={() => {
                      const bike = catalog.bikes[Math.floor(Math.random() * catalog.bikes.length)];
                      location.assign(`${base}?bike=${bike.id}`);
                    }}
                  >
                    <Shuffle size={15} />
                    偶遇一台车
                  </button>
                </div>
                <div className="discovery-machine">
                  <div className="feature-topline">
                    <span>FROM THE ARCHIVE</span>
                    <span>2019 / SPECIALIZED</span>
                  </div>
                  <a href={`${base}?bike=${feature.id}`} aria-label="探索 S-Works Venge">
                    <strong className="feature-name">VENGE</strong>
                    <img
                      src={imageUrl(feature.image)}
                      alt="2019 S-Works Venge 官方整车图"
                      fetchPriority="high"
                    />
                  </a>
                  <div className="feature-caption">
                    <div>
                      <span>本期驻足</span>
                      <h2>独立破风平台的经典侧影。</h2>
                    </div>
                    <SaveButton bike={feature} />
                  </div>
                </div>
              </section>
              <section className="discovery-section">
                <div className="editorial-heading">
                  <div>
                    <span className="eyebrow">CURATED CURIOSITY</span>
                    <h2>从一个好奇开始。</h2>
                  </div>
                  <a className="text-link" href={`${base}?view=stories`}>
                    全部专题 <ArrowUpRight size={17} />
                  </a>
                </div>
                <StoryCards catalog={catalog} limit={3} />
                <div className="reading-paths">
                  <a href={`${base}?view=generations`}>
                    <small>THE FAMILY TREE</small>
                    <h3>经典车型世代谱</h3>
                    <p>一个名字，跨过几个时代。</p>
                    <span>沿时间线看设计 →</span>
                  </a>
                  <a href={`${base}?view=riders`}>
                    <small>BUILT BY RIDERS</small>
                    <h3>车友装车故事</h3>
                    <p>从一张配置单，到真正骑它的人。</p>
                    <span>阅读与投稿 →</span>
                  </a>
                </div>
              </section>
              <section className="comparison-invite">
                <div>
                  <span className="eyebrow">SAME SCALE. DIFFERENT INTENT.</span>
                  <h2>
                    差几毫米，
                    <br />
                    放在一起就看懂了。
                  </h2>
                  <p>分别选尺码，让五通对齐。看看竞赛、耐力与砾石平台，怎样安排同一副三角。</p>
                  <a
                    className="acid-button"
                    href={`${base}${comparisonSearch(['tcr-pro0', 'defy-pro0', 'revolt-advanced0'].map((bikeId) => ({ bikeId, size: 'M' })))}`}
                  >
                    <Columns3 size={17} />
                    试试 TCR / Defy / Revolt 对比 <ArrowRight size={18} />
                  </a>
                </div>
                <div className="invite-geometry" aria-hidden="true">
                  <svg viewBox="0 0 600 330" fill="none">
                    <path
                      className="invite-grid"
                      d="M0 80H600M0 160H600M0 240H600M100 0V330M200 0V330M300 0V330M400 0V330M500 0V330"
                    />
                    <path
                      stroke="#d5f660"
                      strokeWidth="2.5"
                      d="M245 280L187 78L403 54L419 103Z M187 78L75 252L245 280 M419 103L540 252"
                    />
                    <path
                      stroke="#adbda4"
                      strokeDasharray="7 6"
                      strokeWidth="2"
                      d="M245 280L182 62L400 30L418 86Z M182 62L65 250L245 280 M418 86L557 250"
                    />
                    <circle cx="245" cy="280" r="6" fill="#d5f660" />
                    <text x="263" y="303" fill="#adbda4" fontSize="12">
                      BB / ALIGN HERE
                    </text>
                    <text x="60" y="26" fill="#adbda4" fontSize="11">
                      尺寸关系概念图 · 打开对比查看实际数据
                    </text>
                  </svg>
                </div>
              </section>
              <section className="discovery-section">
                <div className="editorial-heading">
                  <div>
                    <span className="eyebrow">MORE ROADS TO EXPLORE</span>
                    <h2>展厅里的新面孔。</h2>
                  </div>
                  <a className="text-link" href={`${base}?view=bikes`}>
                    浏览 {catalog.bikes.length} 款车 <ArrowUpRight size={17} />
                  </a>
                </div>
                <div className="bike-grid">
                  {picks.map((bike) => (
                    <BikeCard key={bike.id} bike={bike} />
                  ))}
                </div>
              </section>
              <section className="garage-invite">
                <span className="eyebrow">YOUR OWN LITTLE COLLECTION</span>
                <h2>喜欢的车，给它留个位置。</h2>
                <p>
                  收藏一款涂装，记下心动的原因。想拥有的、已经拥有的、只是喜欢的，都可以放进来。
                </p>
                <a className="text-link" href={`${base}?view=garage`}>
                  打开我的车库 <ArrowRight size={17} />
                </a>
              </section>
            </>
          );
        }}
      </CatalogContent>
    </PageFrame>
  );
}
