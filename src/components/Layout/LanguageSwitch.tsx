import { useTranslation } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitch() {
  const { language, toggleLanguage } = useTranslation();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="gap-2 rounded-xl border-slate-900/20 bg-white/75 text-slate-700 hover:bg-slate-900 hover:text-white"
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">
        {language === 'en' ? '中文' : 'EN'}
      </span>
    </Button>
  );
}
