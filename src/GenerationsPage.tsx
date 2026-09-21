import { useState } from 'react';
import generations from './data/generations.json';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { imageUrl } from './catalog';
import type { Catalog } from './types';
import './community.css';
export default function GenerationsPage() {
  usePageTitle('经典车型世代谱');
  return (
    <PageFrame active="stories">
      <CatalogContent>{(catalog) => <Generations catalog={catalog} />}</CatalogContent>
    </PageFrame>
  );
}
function GenerationPhoto({
  node,
  catalog,
}: {
  node: (typeof generations)[number]['nodes'][number];
  catalog: Catalog;
}) {
  const bike = catalog.bikes.find((b) => b.id === node.bikeId);
  const src = node.image || bike?.image;
  if (!src) return null;
  return (
    <figure className={`generation-photo ${node.image ? 'archive-photo' : ''}`}>
      <a
        href={node.imageSource || bike?.imageSource || node.source}
        target="_blank"
        rel="noreferrer"
        aria-label={`${node.name} 图片原始出处`}
      >
        <img
          src={imageUrl(src)}
          alt={node.image ? `${node.name} · ${node.imageCaption}` : `${bike!.name} 同代图鉴参考车`}
          loading="lazy"
        />
      </a>
      <figcaption>
        {node.imageCaption ||
          `同代图鉴参考图 · ${bike!.edition} · ${bike!.imageCredit}。图中涂装与配置年份不一定等于本节点年份。`}
      </figcaption>
    </figure>
  );
}
function Generations({ catalog }: { catalog: Catalog }) {
  const query = new URLSearchParams(location.search),
    initial = generations.find((g) => g.id === query.get('family')) || generations[0];
  const [familyId, setFamilyId] = useState(initial.id),
    [nodeId, setNodeId] = useState(
      initial.nodes.find((n) => n.id === query.get('generation'))?.id || initial.nodes[0].id,
    ),
    [comparing, setComparing] = useState(false),
    [message, setMessage] = useState(''),
    [link, setLink] = useState('');
  const family = generations.find((f) => f.id === familyId)!,
    index = Math.max(
      0,
      family.nodes.findIndex((n) => n.id === nodeId),
    ),
    node = family.nodes[index],
    previous = family.nodes[index - 1],
    bike = catalog.bikes.find((b) => b.id === node.bikeId);
  const pick = (id: string) => {
    setNodeId(id);
    setLink('');
    setMessage('');
  };
  const share = async () => {
    const url = `${location.origin}${base}?view=generations&family=${family.id}&generation=${node.id}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage('这一代的链接已复制。');
    } catch {
      setMessage('请手动复制下方链接。');
    }
  };
  return (
    <>
      <a className="back-link" href={`${base}?view=stories`}>
        ← 全部专题
      </a>
      <header className="page-heading">
        <span className="eyebrow">THE FAMILY TREE / 经典车型世代谱</span>
        <h1>熟悉的名字，变过多少次模样？</h1>
        <p>沿着设计变化往回看。先认识一代车的选择，再把它放回自己的时代。</p>
      </header>
      <nav className="generation-families" aria-label="车型家族">
        {generations.map((f) => (
          <button
            key={f.id}
            aria-pressed={f.id === family.id}
            onClick={() => {
              setFamilyId(f.id);
              pick(f.nodes[0].id);
              setComparing(false);
            }}
          >
            <small>{f.name}</small>
            <strong>{f.short}</strong>
            <span>{f.nodes.length} 个档案节点 →</span>
          </button>
        ))}
      </nav>
      <section className="generation-intro">
        <h2>{family.subtitle}</h2>
        <p>{family.note}</p>
      </section>
      <nav className="generation-timeline" aria-label={`${family.short} 世代节点`}>
        {family.nodes.map((n, i) => (
          <button key={n.id} aria-pressed={n.id === node.id} onClick={() => pick(n.id)}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>{n.year}</strong>
            <b>{n.name}</b>
            <small>{n.basis}</small>
          </button>
        ))}
      </nav>
      <div className="generation-focus">
        <div className="generation-visual">
          <GenerationPhoto node={node} catalog={catalog} />
        </div>
        <article className="generation-copy">
          <span className="eyebrow">
            {node.year} / {node.basis} / {node.name}
          </span>
          <h2>{node.title}</h2>
          <p>{node.text}</p>
          <div>
            <small>这一代改变了什么</small>
            <p>{node.change}</p>
          </div>
          <div>
            <small>看车时留意</small>
            <p>{node.look}</p>
          </div>
          <div className="work-actions">
            {bike && (
              <a className="dark-button" href={`${base}?bike=${bike.id}`}>
                看同代车型完整档案 →
              </a>
            )}
            <a className="text-link" href={node.source} target="_blank" rel="noreferrer">
              核对原厂资料 ↗
            </a>
            <button className="light-button" onClick={share}>
              分享这一代
            </button>
          </div>
          <p className="work-status" role="status">
            {message}
          </p>
          {link && (
            <label>
              世代链接
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </label>
          )}
        </article>
      </div>
      {previous && (
        <section className="generation-comparison work-panel">
          <label className="consent-row">
            <input
              type="checkbox"
              checked={comparing}
              onChange={(e) => setComparing(e.target.checked)}
            />
            把上一档案节点放在旁边
          </label>
          {comparing && (
            <div className="generation-columns">
              {[previous, node].map((n) => (
                <article key={n.id}>
                  <span className="eyebrow">
                    {n.year} · {n.basis}
                  </span>
                  <h3>{n.name}</h3>
                  <GenerationPhoto node={n} catalog={catalog} />
                  <p>{n.change}</p>
                  <small>观察重点</small>
                  <p>{n.look}</p>
                  <a href={n.source} target="_blank" rel="noreferrer">
                    该节点来源 ↗
                  </a>
                </article>
              ))}
            </div>
          )}
          <p className="work-note">
            这里比较设计取向，不把不同条件下的厂商重量或风阻数据排成性能排行榜。部分早期世代尚未收录，上一节点不一定是紧邻的一代。
          </p>
        </section>
      )}
      <div className="generation-pagination">
        <button className="light-button" disabled={!previous} onClick={() => pick(previous.id)}>
          ← 上一节点
        </button>
        <span>
          {index + 1} / {family.nodes.length}
        </span>
        <button
          className="light-button"
          disabled={index === family.nodes.length - 1}
          onClick={() => pick(family.nodes[index + 1].id)}
        >
          下一节点 →
        </button>
      </div>
      <p className="work-note">
        资料整理：2026-09-21。历史节点使用品牌官方档案照片，其余节点使用图鉴中的同代车型，图片说明中标注出处与对应版本。发布年份、车型年与涂装年份分别注明。
      </p>
    </>
  );
}
