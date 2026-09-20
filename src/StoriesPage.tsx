import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import stories from './data/stories.json';
import { base, CatalogContent, PageFrame, usePageTitle } from './SiteChrome';
import { imageUrl } from './catalog';
import { comparisonSearch } from './experience';
import { StoryCards } from './Discover';
import { CompareButton, SaveButton } from './Library';

export default function StoriesPage() {
  const storyId = new URLSearchParams(location.search).get('story');
  const story = stories.find((item) => item.id === storyId);
  usePageTitle(story?.title || '专题');
  return (
    <PageFrame active="stories">
      <CatalogContent>
        {(catalog) =>
          story ? (
            <>
              <a className="back-link" href={`${base}?view=stories`}>
                <ArrowLeft size={15} />
                全部专题
              </a>
              <header className="story-heading">
                <span className="eyebrow">{story.tag}</span>
                <h1>{story.title}</h1>
                <p>{story.subtitle}</p>
              </header>
              <div className="story-intro">
                <span>
                  EDITOR’S NOTE
                  <br />
                  编辑选集 · {story.number}
                </span>
                <p>{story.intro}</p>
              </div>
              <div className="story-chapters">
                {story.chapters.map((chapter, index) => {
                  const bike = catalog.bikes.find((b) => b.id === chapter.bikeId)!;
                  return (
                    <section className="story-chapter" key={chapter.bikeId}>
                      <div className="chapter-photo">
                        <div>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <span>{chapter.label}</span>
                        </div>
                        <a href={`${base}?bike=${bike.id}`}>
                          <img src={imageUrl(bike.image)} alt={bike.name} loading="lazy" />
                        </a>
                        <div>
                          <SaveButton bike={bike} />
                          <CompareButton bike={bike} />
                        </div>
                      </div>
                      <div className="chapter-copy">
                        <span className="eyebrow">{bike.family}</span>
                        <h2>{chapter.title}</h2>
                        <p>{chapter.text}</p>
                        <p className="look-note">{chapter.look}</p>
                        <div className="chapter-links">
                          <a className="text-link" href={`${base}?bike=${bike.id}`}>
                            看照片与完整档案 <ArrowRight size={16} />
                          </a>
                          <a
                            className="source-link"
                            href={bike.source}
                            target="_blank"
                            rel="noreferrer"
                          >
                            原厂资料 <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className="story-end">
                <h2>把这几台车，放到一起看。</h2>
                <p>{story.closing}</p>
                <a
                  className="dark-button"
                  href={`${base}${comparisonSearch(story.compare.map((bikeId) => ({ bikeId, size: catalog.bikes.find((b) => b.id === bikeId)!.geometry.defaultSize })))}`}
                >
                  打开本专题整车对比 <ArrowRight size={17} />
                </a>
              </div>
            </>
          ) : (
            <>
              <header className="page-heading">
                <span className="eyebrow">THE READING ROOM</span>
                <h1>车有参数，也有性格。</h1>
                <p>沿着一个细节、一段世代、或一种骑行方式，重新认识那些熟悉的名字。</p>
                {storyId && <p role="status">这篇专题暂未收录，可以从下面的选集继续阅读。</p>}
              </header>
              <div className="reading-paths">
                <a href={`${base}?view=generations`}>
                  <small>THE FAMILY TREE</small>
                  <h2>经典车型世代谱</h2>
                  <p>Tarmac、Madone、TCR：沿设计变化逐代看。</p>
                  <span>走进年代档案 →</span>
                </a>
                <a href={`${base}?view=riders`}>
                  <small>BUILT BY RIDERS</small>
                  <h2>车友装车故事</h2>
                  <p>骑行场景、配置取舍，以及后来才知道的事。</p>
                  <span>看看车与它的主人 →</span>
                </a>
              </div>
              <StoryCards catalog={catalog} />
            </>
          )
        }
      </CatalogContent>
    </PageFrame>
  );
}
