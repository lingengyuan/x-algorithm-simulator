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
      aria-label={language === 'en' ? '切换到中文' : 'Switch to English'}
      className="gap-2"
    >
      <Globe className="w-4 h-4" />
      <span className="text-xs">
        {language === 'en' ? '中文' : 'EN'}
      </span>
    </Button>
  );
}
