export const storyFields = [
  ['title', '故事标题', 80],
  ['bike', '我的车', 120],
  ['scene', '我怎么骑', 500],
  ['setup', '装车配置', 1200],
  ['reason', '为什么这样选', 1200],
  ['upgrade', '最值得的一次升级', 800],
  ['lesson', '踩过的坑', 800],
];
export const storyMarker = '<!-- velodex-story:v1 -->';
export const consentMarker = '<!-- velodex-share:yes -->';
export function emptyStory() {
  return Object.fromEntries([...storyFields.map(([key]) => [key, '']), ['photo', '']]);
}
export function safeStoryPhoto(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash)
      return '';
    if (
      (u.hostname === 'github.com' &&
        /^\/user-attachments\/assets\/[a-f0-9-]{36}$/i.test(u.pathname)) ||
      (u.hostname === 'user-images.githubusercontent.com' &&
        /^\/\d+\/[a-z0-9_.-]+$/i.test(u.pathname))
    )
      return u.href;
  } catch {
    /* An unrecognized image is omitted. */
  }
  return '';
}
export function cleanStory(value, requireContent = true) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('故事格式无效');
  const result = emptyStory();
  for (const [key, label, max] of storyFields) {
    if (typeof value[key] !== 'string' || value[key].length > max)
      throw new Error(`${label}过长或格式无效`);
    result[key] = value[key].trim();
  }
  if (requireContent && ['title', 'bike', 'scene', 'reason'].some((key) => !result[key]))
    throw new Error('请先填写标题、车型、骑行场景和选择理由。');
  if (typeof value.photo === 'string') {
    if (value.photo && !safeStoryPhoto(value.photo))
      throw new Error('照片请使用 GitHub 上传后生成的图片地址。');
    result.photo = safeStoryPhoto(value.photo);
  }
  return result;
}
const escape = (s) => s.replace(/[\\`*_{}\[\]()#+.!<>|~\-]/g, '\\$&');
export function storyMarkdown(value) {
  const story = cleanStory(value);
  return [
    '## VÉLODEX · 车友装车故事',
    storyMarker,
    ...storyFields.map(
      ([key, label]) =>
        `### ${label}\n${(story[key] || '暂未填写')
          .split('\n')
          .map((line) => '> ' + escape(line))
          .join('\n')}`,
    ),
    '### 实车照片',
    story.photo
      ? `![我的实车](${story.photo})`
      : '可在这里拖入自己的实车照片，也可以暂时不放照片。',
    '同意将本故事、GitHub 署名及所附照片展示在 VÉLODEX 车友故事页；照片为本人拍摄或已获展示许可。',
    consentMarker,
  ].join('\n\n');
}
export function parseRiderStory(body) {
  if (
    typeof body !== 'string' ||
    body.length > 30000 ||
    !body.includes(storyMarker) ||
    !body.includes(consentMarker)
  )
    return null;
  try {
    const headings = [...body.matchAll(/^### (.+)\s*$/gm)];
    if (headings.filter((h) => h[1].trim() === '实车照片').length !== 1) return null;
    const value = emptyStory();
    for (const [key, label] of storyFields) {
      const matches = headings.filter((m) => m[1].trim() === label);
      if (matches.length !== 1) return null;
      const m = matches[0],
        next = headings.find((h) => h.index > m.index);
      value[key] = body
        .slice(m.index + m[0].length, next?.index ?? body.length)
        .trim()
        .split('\n')
        .map((s) => s.replace(/^> ?/, '').replace(/\\([\\`*_{}\[\]()#+.!<>|~\-])/g, '$1'))
        .join('\n')
        .trim();
      if (value[key] === '暂未填写') value[key] = '';
    }
    const photoSection = body.slice(body.indexOf('### 实车照片'));
    const photos = [
      ...photoSection.matchAll(
        /!\[[^\]\n]*\]\((https:\/\/[^\s)]+)\)|<img\b[^<>]*?\bsrc=["'](https:\/\/[^"'\s]+)["'][^<>]*>/gi,
      ),
    ]
      .map((m) => safeStoryPhoto(m[1] || m[2]))
      .filter(Boolean);
    value.photo = photos[0] || '';
    return cleanStory(value);
  } catch {
    return null;
  }
}
export function exportRiderStories(comments) {
  return comments
    .filter((c) => !c.isMinimized)
    .flatMap((c) => {
      const story = parseRiderStory(c.body);
      if (
        !story ||
        !/^https:\/\/github\.com\/hliangzhao\/velodex\/discussions\/1#discussioncomment-\d+$/.test(
          c.url,
        )
      )
        return [];
      return [
        {
          ...story,
          id: c.id,
          author: c.author?.login || '已注销用户',
          url: c.url,
          createdAt: c.createdAt,
        },
      ];
    })
    .reverse();
}
