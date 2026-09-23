import { useEffect, useState } from 'react';
import { base, PageFrame, usePageTitle } from './SiteChrome';
import {
  cleanStory,
  emptyStory,
  storyFields,
  storyMarkdown,
  safeStoryPhoto,
  type StoryDraft,
  type RiderStory,
} from '../shared/rider-stories.mjs';
import './community.css';
const discussion = 'https://github.com/hliangzhao/velodex/discussions/1';
const draftKey = 'velodex.rider-story.v1';
type Snapshot = {
  updatedAt: string | null;
  available: boolean;
  scanned: number;
  stories: RiderStory[];
};
export default function RiderStoriesPage() {
  usePageTitle('车友装车故事');
  const query = new URLSearchParams(location.search);
  const [draft, setDraft] = useState<StoryDraft>(emptyStory),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState(''),
    [manuscript, setManuscript] = useState(''),
    [data, setData] = useState<Snapshot>(),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(false),
    [search, setSearch] = useState('');
  const load = () => {
    setLoading(true);
    setError(false);
    fetch(import.meta.env.MODE === 'pages' ? `${base}rider-stories.json` : '/api/rider-stories', {
      cache: 'no-cache',
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (!Array.isArray(d.stories)) throw new Error();
        setData(d);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    try {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('draft');
      const saved = incoming || localStorage.getItem(draftKey);
      if (saved) setDraft(cleanStory(JSON.parse(saved), false));
      if (incoming)
        setMessage(
          '已带入车型和配置名称。重量、预算与备齐进度没有带入；保存草稿后才会更新本机内容。',
        );
      if (incoming || new URLSearchParams(location.search).get('compose') === '1')
        document.getElementById('story-compose')?.scrollIntoView({ block: 'start' });
    } catch {
      setMessage('未能读取草稿，原本机内容仍保留。');
    }
  }, []);
  const edit = (key: keyof StoryDraft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setManuscript('');
    setMessage('');
  };
  const save = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(cleanStory(draft, false)));
      setMessage('草稿已保存到当前浏览器。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败，请复制稿件。');
    }
  };
  const prepare = async () => {
    if (!consent) {
      setMessage('请确认公开展示及照片使用许可。');
      return;
    }
    try {
      const text = storyMarkdown(draft);
      setManuscript(text);
      await navigator.clipboard.writeText(text);
      setMessage('稿件已复制，尚未发布。到 GitHub 粘贴、添加实车照片并提交后，才会进入公开故事。');
    } catch (e) {
      setMessage(
        e instanceof Error ? `请检查内容或手动复制下方稿件：${e.message}` : '请手动复制下方稿件。',
      );
    }
  };
  const selected = data?.stories.find((s) => s.id === query.get('reader'));
  const stories = (selected ? [selected] : data?.stories || []).filter((s) =>
    `${s.title} ${s.bike} ${s.author} ${s.scene}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <PageFrame active="stories">
      <header className="page-heading">
        <span className="eyebrow">BUILT BY RIDERS / 车与它的主人</span>
        <h1>车友的选车与骑行经历</h1>
        <p>分享选车原因、改装经历和实际骑行感受。</p>
        <div className="work-actions">
          <a className="dark-button" href="#story-compose">
            写我的装车故事 ↗
          </a>
          <a className="text-link" href={`${base}?view=workshop&tool=build`}>
            先做一张装车单 →
          </a>
        </div>
      </header>
      <section className="rider-feed" aria-label="车友故事">
        <div className="editorial-heading">
          <h2>骑友来稿</h2>
          <button className="light-button" onClick={load} disabled={loading}>
            刷新故事
          </button>
        </div>
        <label className="rider-search">
          找一台车或一个骑友
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="车型、作者、骑行场景"
          />
        </label>
        {selected && (
          <a className="text-link" href={`${base}?view=riders`}>
            ← 全部车友故事
          </a>
        )}
        {error ? (
          <p role="status">
            故事快照暂时无法读取。
            <a href={discussion} target="_blank" rel="noreferrer">
              去完整留言区看看 ↗
            </a>
          </p>
        ) : !data ? (
          <p role="status">正在读取骑友来稿…</p>
        ) : (
          <>
            {query.has('reader') && !selected && (
              <p role="status">这篇故事不在当前快照中，可前往原讨论查看。</p>
            )}
            {stories.length ? (
              <div className="rider-story-grid">
                {stories.map((s) => (
                  <article className="rider-story" key={s.id}>
                    {safeStoryPhoto(s.photo) && (
                      <img
                        className="rider-photo"
                        src={s.photo}
                        alt={`${s.author} 的 ${s.bike}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.hidden = true;
                        }}
                      />
                    )}
                    <div className="rider-story-body">
                      <span className="eyebrow">
                        {s.author} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      <h3>{s.title}</h3>
                      <strong>{s.bike}</strong>
                      <p>{s.scene}</p>
                      <div className="rider-reason">
                        <small>为什么这样选</small>
                        <p>{s.reason}</p>
                      </div>
                      <details>
                        <summary>配置、升级与踩坑记录</summary>
                        {(['setup', 'upgrade', 'lesson'] as const).map((key) => (
                          <div key={key}>
                            <h4>{storyFields.find((f) => f[0] === key)![1]}</h4>
                            <p>{s[key] || '作者暂未填写。'}</p>
                          </div>
                        ))}
                      </details>
                      <div className="work-actions">
                        <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                          交流 / 作者编辑 ↗
                        </a>
                        <a
                          className="text-link"
                          href={`${base}?view=riders&reader=${encodeURIComponent(s.id)}`}
                        >
                          故事独立链接 →
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rider-empty">
                <span>THE FIRST CHAPTER</span>
                <h3>{search ? '暂无符合条件的故事' : '暂无车友故事'}</h3>
                <p>
                  一张实车照片、一套配置、一个选择它的理由，就可以开始。升级和踩坑经历可以以后再补。
                </p>
              </div>
            )}
            <p className="work-note">
              {data.updatedAt
                ? `快照更新：${new Date(data.updatedAt).toLocaleString('zh-CN')}。`
                : ''}
              收录公开留言区最近 100
              条主留言中主动同意展示的故事。内容为作者经验；编辑、删除或隐藏后随下一次成功发布同步。
            </p>
          </>
        )}
      </section>
      <section id="story-compose" className="story-compose work-panel">
        <span className="eyebrow">YOUR BUILD, YOUR REASONS</span>
        <h2>分享用车经历</h2>
        <p>
          先在这里整理并预览，再复制到 GitHub 留言区发布。草稿保存在本机；发布后会展示 GitHub 署名。
        </p>
        <div className="rider-compose-grid">
          <div className="rider-form">
            {storyFields.map(([key, label, max]) => (
              <label key={key}>
                {label}
                {['title', 'bike', 'scene', 'reason'].includes(key) ? ' *' : ' · 选填'}
                {key === 'title' || key === 'bike' ? (
                  <input
                    value={draft[key]}
                    maxLength={max}
                    onChange={(e) => edit(key, e.target.value)}
                    placeholder={
                      key === 'title'
                        ? '例如：把第一台车慢慢装成适合自己的样子'
                        : '车型 / 年代 / 尺码，可写图鉴之外的车'
                    }
                  />
                ) : (
                  <textarea
                    value={draft[key]}
                    maxLength={max}
                    rows={key === 'setup' ? 5 : 3}
                    onChange={(e) => edit(key, e.target.value)}
                    placeholder={
                      {
                        scene: '常骑什么路？独骑、团练，还是长距离？',
                        setup: '车架、变速、轮组、轮胎以及你想介绍的小件。',
                        reason: '为什么选择它？放弃了什么，又留下了什么？',
                        upgrade: '哪次改动最值得？骑了多久，有什么变化？',
                        lesson: '不合适的尺寸、买错的接口，或其他想提醒骑友的事。',
                      }[key]
                    }
                  />
                )}
              </label>
            ))}
            <details>
              <summary>已有 GitHub 实车图片地址？</summary>
              <label>
                实车照片地址 · 选填
                <input
                  type="url"
                  value={draft.photo}
                  maxLength={600}
                  onChange={(e) => edit('photo', e.target.value)}
                  placeholder="https://github.com/user-attachments/assets/…"
                />
              </label>
              <p className="work-note">
                也可以先不填，复制稿件后直接把照片拖入 GitHub
                编辑框的“实车照片”段落。本站展示第一张支持的 GitHub
                图片；请不要用官方整车图冒充自己的实车。
              </p>
            </details>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setManuscript('');
                }}
              />
              我同意公开展示故事、GitHub 署名及照片，并拥有照片的展示许可。
            </label>
            <div className="work-actions">
              <button className="light-button" onClick={save}>
                保存本机草稿
              </button>
              <button className="dark-button" onClick={prepare}>
                生成并复制投稿稿件
              </button>
            </div>
            <p role="status" className="work-status">
              {message}
            </p>
            {manuscript && (
              <div className="manuscript">
                <label>
                  投稿稿件（可手动复制）
                  <textarea
                    readOnly
                    value={manuscript}
                    rows={8}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <a
                  className="dark-button"
                  href={`${discussion}#discussioncomment-new`}
                  target="_blank"
                  rel="noreferrer"
                >
                  到 GitHub 粘贴、附图并发布 ↗
                </a>
                <p className="work-note">
                  复制不等于发布。保留稿件结构与展示同意标记，故事会在下次网站发布后出现。后续可在
                  GitHub 编辑或删除原留言；撤回展示也可删除最后的同意标记。站内快照更新可能延迟。
                </p>
              </div>
            )}
          </div>
          <aside className="rider-draft-preview">
            <span className="eyebrow">LIVE PREVIEW / 尚未发布</span>
            {safeStoryPhoto(draft.photo) && (
              <img src={draft.photo} alt="草稿实车照片预览" referrerPolicy="no-referrer" />
            )}
            <h3>{draft.title || '你的故事标题'}</h3>
            <strong>{draft.bike || '你的车'}</strong>
            {storyFields.slice(2).map(([key, label]) => (
              <section key={key}>
                <h4>{label}</h4>
                <p>{draft[key] || '这一段，等你来写。'}</p>
              </section>
            ))}
          </aside>
        </div>
      </section>
    </PageFrame>
  );
}
