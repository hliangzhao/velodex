import { ArrowUpRight } from 'lucide-react';
import type { Catalog } from './types';
import { base } from './SiteChrome';

type GuideTable = { caption: string; columns: string[]; rows: string[][] };
export type StoryGuideData = {
  checkedAt: string;
  minutes: number;
  summary: GuideTable;
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    sourceIds: string[];
    table?: GuideTable;
  }[];
  buildIds: string[];
  sources: { id: string; title: string; url: string }[];
};

export function GuideTable({ table }: { table: GuideTable }) {
  return (
    <div className="story-table-scroll" role="region" aria-label={table.caption} tabIndex={0}>
      <table className="story-table">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(([label, ...cells]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuideOverview({ guide }: { guide: StoryGuideData }) {
  return (
    <div className="story-guide-overview">
      <p className="story-guide-meta">
        约 {guide.minutes} 分钟 · 资料核对 {guide.checkedAt}
      </p>
      <GuideTable table={guide.summary} />
      <nav className="story-guide-nav" aria-label="专题目录">
        <a href="#series-overview">三款代表车型</a>
        {guide.sections.map((s) => (
          <a href={`#${s.id}`} key={s.id}>
            {s.title}
          </a>
        ))}
        <a href="#build-table">整车配置速查</a>
      </nav>
    </div>
  );
}

export default function StoryGuide({
  guide,
  catalog,
}: {
  guide: StoryGuideData;
  catalog: Catalog;
}) {
  return (
    <article className="story-guide">
      {guide.sections.map((s) => (
        <section id={s.id} key={s.id} className="story-guide-section">
          <h2>{s.title}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.table && <GuideTable table={s.table} />}
          <div className="story-guide-citations">
            资料来源：
            {s.sourceIds.map((id) => {
              const source = guide.sources.find((item) => item.id === id)!;
              return (
                <a key={id} href={source.url} target="_blank" rel="noreferrer">
                  {source.title} ↗
                </a>
              );
            })}
          </div>
        </section>
      ))}
      <section id="build-table" className="story-guide-section story-builds">
        <h2>本次收录的整车配置</h2>
        <p>
          点击车型打开照片、涂装和部件热点。重量为各厂商页面的标称值；详细口径和资料冲突见车型档案。窄屏可左右滚动表格。
        </p>
        <div
          className="story-table-scroll"
          role="region"
          aria-label="Van Rysel 整车配置速查"
          tabIndex={0}
        >
          <table className="story-table">
            <caption>具体版本对照</caption>
            <thead>
              <tr>
                {['系列 / 版本', '套件', '轮组', '功率计', '标称整车重量'].map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.buildIds.map((id) => {
                const bike = catalog.bikes.find((b) => b.id === id)!;
                return (
                  <tr key={id}>
                    <th scope="row">
                      <a href={`${base}?bike=${id}`}>
                        {bike.family} <ArrowUpRight size={13} />
                      </a>
                      <small>{bike.edition}</small>
                    </th>
                    <td>{bike.build}</td>
                    <td>{bike.components.find((p) => p.id === 'wheels')!.title}</td>
                    <td>{bike.components.find((p) => p.id === 'power')!.title}</td>
                    <td>
                      {bike.weight}
                      <small>M 码 · 真空胎配置</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <a className="text-link" href={`${base}?view=bikes&brand=vanrysel`}>
          查看全部 Van Rysel 车型 <ArrowUpRight size={15} />
        </a>
      </section>
    </article>
  );
}
