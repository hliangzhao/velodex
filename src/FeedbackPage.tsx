import { useEffect, useState } from 'react';
import { ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { base, PageFrame, usePageTitle } from './SiteChrome';
import './workshop.css';
const discussion = 'https://github.com/hliangzhao/velodex/discussions/1';
type Comment = {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  author: string;
  replies?: Comment[];
  replyTotal?: number;
};
type Feedback = { updatedAt: string; available?: boolean; total: number; comments: Comment[] };
const date = (value: string) =>
  new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
function ReaderComment({ item }: { item: Comment }) {
  return (
    <article className="feedback-comment">
      <header>
        <strong>{item.author}</strong>
        <time dateTime={item.createdAt}>{date(item.createdAt)}</time>
      </header>
      <p>{item.text}</p>
      <a href={item.url} target="_blank" rel="noreferrer">
        在 GitHub 查看与回复 ↗
      </a>
      {!!item.replies?.length && (
        <div className="feedback-replies">
          {item.replies.map((reply) => (
            <ReaderComment key={reply.id} item={reply} />
          ))}
          {(item.replyTotal || 0) > item.replies.length && (
            <a href={item.url} target="_blank" rel="noreferrer">
              查看全部 {item.replyTotal} 条回复 ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}
export default function FeedbackPage() {
  usePageTitle('读者留言');
  const [data, setData] = useState<Feedback>(),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(false),
    [draft, setDraft] = useState(''),
    [status, setStatus] = useState('');
  const feedbackUrl =
    data?.available === false ? 'https://github.com/hliangzhao/velodex/discussions' : discussion;
  const load = () => {
    setLoading(true);
    setError(false);
    fetch(`${base}feedback.json`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((value) => {
        if (!value || !Array.isArray(value.comments)) throw new Error();
        setData(value);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    try {
      setDraft(localStorage.getItem('velodex.feedback-draft') || '');
    } catch {
      /* Drafts remain usable when storage is unavailable. */
    }
  }, []);
  const edit = (text: string) => {
    setDraft(text);
    try {
      localStorage.setItem('velodex.feedback-draft', text);
    } catch {
      setStatus('浏览器未允许保存草稿，请先复制内容。');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setStatus('草稿已复制。打开 GitHub 后粘贴并发布，站长才能收到；目前尚未提交。');
    } catch {
      setStatus('自动复制未成功，请手动选中草稿复制，再打开 GitHub 发布。');
    }
  };
  return (
    <PageFrame active="feedback">
      <div className="work-heading">
        <div>
          <span className="eyebrow">THE GUESTBOOK / 骑友来信</span>
          <h1>把下一次更新，交给好奇心。</h1>
          <p>想看一台车、发现一个错误，或只是来聊聊自己的装车思路。</p>
        </div>
        <a href={feedbackUrl} target="_blank" rel="noreferrer">
          完整留言区 <ExternalLink size={16} />
        </a>
      </div>
      <div className="tool-layout">
        <section className="work-panel feedback-compose">
          <span className="eyebrow">LEAVE A NOTE</span>
          <h2>给图鉴留一句话。</h2>
          <p>
            留言使用 GitHub Discussions 保存，登录 GitHub
            后即可公开发布。站内展示近期留言快照，新留言通常随网站自动发布更新；即时内容请打开完整讨论。
          </p>
          <label>
            留言草稿（只保存在当前浏览器）
            <textarea
              value={draft}
              maxLength={5000}
              onChange={(e) => edit(e.target.value)}
              placeholder="我想补充的车型是… / 这个参数可能有误，来源是…"
            />
          </label>
          <div className="work-actions">
            <button className="light-button" disabled={!draft.trim()} onClick={copy}>
              <Copy size={16} />
              复制草稿
            </button>
            <a
              className="dark-button"
              href={`${feedbackUrl}#discussioncomment-new`}
              target="_blank"
              rel="noreferrer"
            >
              到 GitHub 粘贴并发布 <ExternalLink size={16} />
            </a>
          </div>
          <p role="status" className="work-status">
            {status}
          </p>
          <p className="work-note">
            点击“复制”不会提交。留言、GitHub
            用户名及回复公开可见，请勿填写私人联系方式。草稿不会上传到本站；清空输入框即可清除本机草稿。
          </p>
        </section>
        <section className="work-panel">
          <div className="build-item-head">
            <h2>骑友留言{data ? ` / ${data.total}` : ''}</h2>
            <button
              className="light-button"
              disabled={loading}
              onClick={load}
              aria-label="刷新留言快照"
            >
              <RefreshCw size={15} />
            </button>
          </div>
          {error ? (
            <p role="status">
              留言快照暂时无法读取。
              <a href={feedbackUrl} target="_blank" rel="noreferrer">
                仍可直接进入完整留言区 ↗
              </a>
            </p>
          ) : !data ? (
            <p role="status">正在读取留言…</p>
          ) : (
            <>
              <p className="work-note">
                快照更新：{date(data.updatedAt)}。展示最近 50 条主留言，每条最近 10
                个回复；刷新读取最新已发布快照。
              </p>
              {data.available === false ? (
                <p>原留言主题已关闭，近期留言暂不展示。请前往仓库讨论区查看最新入口。</p>
              ) : data.comments.length ? (
                <div className="feedback-list">
                  {[...data.comments].reverse().map((item) => (
                    <ReaderComment key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <p>留言区刚刚打开。欢迎留下第一条建议，让这本图鉴继续长大。</p>
              )}
            </>
          )}
          <p className="work-note">若刚发布的内容尚未出现在这里，请以 GitHub 讨论为准。</p>
        </section>
      </div>
    </PageFrame>
  );
}
