import { useTranslation } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitch() {
  const { language, toggleLanguage } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="gap-2"
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">
        {language === 'en' ? '中文' : 'EN'}
      </span>
    </Button>
  );
}
