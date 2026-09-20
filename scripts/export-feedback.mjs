import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const query = `query { repository(owner:"hliangzhao",name:"velodex") { discussion(number:1) { url comments(last:50) { totalCount nodes { id bodyText url createdAt author { login } replies(last:10) { totalCount nodes { id bodyText url createdAt author { login } } } } } } } }`;
let payload;
if (process.env.GITHUB_TOKEN) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Feedback API returned ${response.status}`);
  payload = await response.json();
} else
  payload = JSON.parse(
    execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
      encoding: 'utf8',
      timeout: 20000,
    }),
  );
if (payload.errors) throw new Error('Feedback query failed');
const discussion = payload.data?.repository?.discussion;
const clean = (c) => ({
  id: c.id,
  text: c.bodyText.slice(0, 12000),
  url: c.url,
  createdAt: c.createdAt,
  author: c.author?.login || '已注销用户',
});
const data = {
  updatedAt: new Date().toISOString(),
  url: discussion?.url || 'https://github.com/hliangzhao/velodex/discussions',
  available: Boolean(discussion),
  total: discussion?.comments.totalCount || 0,
  comments: (discussion?.comments.nodes || []).map((c) => ({
    ...clean(c),
    replies: c.replies.nodes.map(clean),
    replyTotal: c.replies.totalCount,
  })),
};
await writeFile(
  new URL('../public/feedback.json', import.meta.url),
  JSON.stringify(data, null, 2) + '\n',
);
console.log(`Exported ${data.comments.length} public feedback comments.`);
