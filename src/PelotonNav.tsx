import { base } from './SiteChrome';

export default function PelotonNav({ active }: { active: 'teams' | 'riders' }) {
  return (
    <nav className="peloton-nav" aria-label="职业赛场栏目">
      <a href={`${base}?view=teams`} aria-current={active === 'teams' ? 'page' : undefined}>
        车队档案
      </a>
      <a href={`${base}?view=riders`} aria-current={active === 'riders' ? 'page' : undefined}>
        车手焦点
      </a>
      <span>PEOPLE × MACHINES</span>
    </nav>
  );
}
