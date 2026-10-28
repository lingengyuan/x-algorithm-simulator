import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useI18n';
import { LanguageSwitch } from './LanguageSwitch';
import { FileText, Workflow, SlidersHorizontal, History, ArrowUpRight } from 'lucide-react';
import { UPSTREAM_SNAPSHOT } from '@/data/upstreamSnapshot';

export function Header() {
  const { t, isZh } = useTranslation();
  const nav = [
    { to: '/', text: t('common.tweetAnalyzer'), Icon: FileText },
    { to: '/simulator', text: t('common.rankingSimulator'), Icon: Workflow },
    { to: '/weights', text: t('common.weightLab'), Icon: SlidersHorizontal },
    { to: '/history', text: t('common.history'), Icon: History },
  ];
  return <header className="app-header">
    <Link to="/simulator" className="product-brand" aria-label="X Algorithm Simulator">
      <svg className="product-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M5 5h6l16 22h-6L5 5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="m26 5-8 10M14 19l-8 8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <div><div className="product-name">{isZh ? 'X 算法工作台' : 'X Algorithm Lab'}</div>
        <div className="product-subtitle">{isZh ? '推荐流程 · 本地模拟' : 'Recommendation simulator'}</div></div>
    </Link>
    <nav className="app-nav" aria-label={isZh ? '主导航' : 'Main navigation'}>
      {nav.map(({to,text,Icon}) => <NavLink key={to} to={to} end={to === '/'} aria-label={text}>
        <Icon aria-hidden="true" /><span>{text}</span>
      </NavLink>)}
    </nav>
    <div className="header-utilities">
      <a className="upstream-link" href={`${UPSTREAM_SNAPSHOT.repository}/commit/${UPSTREAM_SNAPSHOT.commit}`} target="_blank" rel="noreferrer">
        {isZh ? '上游版本' : 'Upstream'} <code>{UPSTREAM_SNAPSHOT.shortCommit}</code><ArrowUpRight size={13} />
      </a>
      <LanguageSwitch />
    </div>
  </header>;
}
