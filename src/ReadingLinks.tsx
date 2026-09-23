import { base } from './SiteChrome';

export default function ReadingLinks() {
  return (
    <>
      <a href={`${base}?view=learn&category=race`}>
        <small>RACE NOTES</small>
        <h3>赛场器材拆解</h3>
        <p>查看具体比赛的公开装配资料与选择依据。</p>
        <span>查看比赛配置 →</span>
      </a>
      <a href={`${base}?view=learn&category=science`}>
        <small>THE SCIENCE OF CYCLING</small>
        <h3>骑行科学读本</h3>
        <p>介绍风阻、齿比、轮胎与功率，配有计算示例和交互工具。</p>
        <span>阅读骑行科普 →</span>
      </a>
    </>
  );
}
