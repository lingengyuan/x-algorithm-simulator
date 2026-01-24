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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">X</span>
            </div>
            <span className="hidden sm:block font-semibold text-gray-900">
              {t('common.appName')}
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-100 text-[#1DA1F2]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Language Switch */}
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
