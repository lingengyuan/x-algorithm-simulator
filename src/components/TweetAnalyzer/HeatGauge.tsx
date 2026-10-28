import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useI18n';
interface HeatGaugeProps { score: number; }
export function HeatGauge({ score }: HeatGaugeProps) {
  const { t, isZh } = useTranslation();
  return <Card>
    <CardHeader><CardTitle>{t('analyzer.heatScore')}</CardTitle></CardHeader>
    <CardContent><div className="summary-index"><strong>{Math.round(score)}<span className="text-sm text-slate-600"> / 100</span></strong><div>
      <p>{isZh ? '根据本地测试输出计算，不代表实际曝光。' : 'Calculated from local fixture outputs. This does not predict reach.'}</p>
      <div className="score-track" aria-hidden="true"><div className="score-fill" style={{ width: `${score}%` }} /></div>
    </div></div></CardContent>
  </Card>;
}
