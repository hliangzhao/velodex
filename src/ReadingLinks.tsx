import { base } from './SiteChrome';

export default function ReadingLinks() {
  return (
    <>
      <a href={`${base}?view=learn&category=race`}>
        <small>RACE NOTES</small>
        <h3>赛场器材拆解</h3>
        <p>从一场比赛，读懂一套配置的选择。</p>
        <span>看赛日档案与设计取舍 →</span>
      </a>
      <a href={`${base}?view=learn&category=science`}>
        <small>THE SCIENCE OF CYCLING</small>
        <h3>骑行科学读本</h3>
        <p>风阻、齿比、轮胎与功率，动手算就更好懂。</p>
        <span>从一个问题开始 →</span>
      </a>
    </>
  );
}
