import ReadingLinks from './ReadingLinks';
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
            'bmc-roadmachine-five',
            'bmc-teammachine-slr01-two',
            'cannondale-superx3',
            'canyon-grail-cf7',
          ].map((id) => catalog.bikes.find((b) => b.id === id)!);
          return (
            <>
              <div className="work-banner">
                <div>
                  <span className="eyebrow">NEW / 骑友工坊</span>
                  <h2>制作你的梦幻装车单</h2>
                  <p>选择车型、涂装和配件，记录预算与重量，生成可分享的装车海报。</p>
                </div>
                <a href={`${base}?view=workshop`}>开始装车 ↗</a>
              </div>
              <div className="discovery-overline">
                <span>
                  <i /> A FIELD GUIDE TO ROAD OBSESSION
                </span>
                <span>
                  {catalog.brands.length} 个品牌 / {catalog.bikes.length} 款车 / 持续更新
                </span>
              </div>
              <section className="discovery-hero">
                <div className="discovery-copy">
                  <span className="eyebrow">公路车与骑行资料</span>
                  <h1>
                    发现喜欢的车
                    <br />
                    了解背后的设计
                  </h1>
                  <p>
                    从经典车型到新款设计，查看整车照片与部件参数，比较车架几何，收藏你喜欢的车。
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
                    随机看一款
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
                      <span>本期精选</span>
                      <h2>S-Works Venge：经典破风车</h2>
                    </div>
                    <SaveButton bike={feature} />
                  </div>
                </div>
              </section>
              <section className="discovery-section">
                <div className="editorial-heading">
                  <div>
                    <span className="eyebrow">CURATED CURIOSITY</span>
                    <h2>车型专题</h2>
                  </div>
                  <a className="text-link" href={`${base}?view=stories`}>
                    全部专题 <ArrowUpRight size={17} />
                  </a>
                </div>
                <StoryCards catalog={catalog} limit={3} />
                <div className="reading-paths">
                  <ReadingLinks />
                  <a href={`${base}?view=generations`}>
                    <small>THE FAMILY TREE</small>
                    <h3>经典车型世代谱</h3>
                    <p>回顾经典车系的设计变化。</p>
                    <span>沿时间线看设计 →</span>
                  </a>
                  <a href={`${base}?view=teams`}>
                    <small>INSIDE THE PELOTON</small>
                    <h3>职业车队与车手</h3>
                    <p>了解车手的比赛特点、车队用车与器材合作。</p>
                    <span>查看车队与车手 →</span>
                  </a>
                </div>
              </section>
              <section className="comparison-invite">
                <div>
                  <span className="eyebrow">SAME SCALE. DIFFERENT INTENT.</span>
                  <h2>
                    比较车架几何
                    <br />
                    看清尺寸差异
                  </h2>
                  <p>
                    选择车型和尺码，以五通为原点叠加车架几何，比较竞赛、耐力与砾石车的尺寸差异。
                  </p>
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
                    <h2>新收录车型</h2>
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
                <h2>收藏你喜欢的车</h2>
                <p>在车库中按涂装收藏车型，区分已拥有和计划购入的车，也可以写下自己的使用感受。</p>
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
