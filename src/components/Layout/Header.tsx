import { NavLink } from 'react-router-dom';
import { useTranslation } from '@/hooks/useI18n';
import { LanguageSwitch } from './LanguageSwitch';
import { cn } from '@/utils/cn';
import { FileText, BarChart3, SlidersHorizontal, History } from 'lucide-react';

export function Header() {
  const { t } = useTranslation();

  const navItems = [
    {
      path: '/',
      label: t('common.tweetAnalyzer'),
      icon: FileText,
    },
    {
      path: '/simulator',
      label: t('common.rankingSimulator'),
      icon: BarChart3,
    },
    {
      path: '/weights',
      label: t('common.weightLab'),
      icon: SlidersHorizontal,
    },
    {
      path: '/history',
      label: t('common.history'),
      icon: History,
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[rgba(255,255,255,0.7)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.5rem] items-center justify-between gap-4 py-3">
          {/* Logo */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-950/20 bg-gradient-to-br from-slate-900 to-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.28)]">
              <span className="text-lg font-black text-white">X</span>
            </div>
            <div className="min-w-0">
              <p className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">
                Recommendation Workshop
              </p>
              <span className="block truncate text-sm font-bold text-slate-900 sm:text-base">
                {t('common.appName')}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-900/10 bg-white/70 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.1)]">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.25)]'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Language Switch */}
          <div className="shrink-0">
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}
