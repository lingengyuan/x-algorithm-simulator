import { WeightConfig } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { WEIGHT_METADATA, DEFAULT_WEIGHTS } from '@/data/defaultWeights';
import { cn } from '@/utils/cn';
import { ThumbsUp, ThumbsDown, Users, Globe } from 'lucide-react';

interface WeightSlidersProps {
  weights: WeightConfig;
  onChange: (weights: WeightConfig) => void;
}

export function WeightSliders({ weights, onChange }: WeightSlidersProps) {
  const { t, isZh } = useTranslation();

  const handleWeightChange = (key: keyof WeightConfig, value: number) => {
    onChange({
      ...weights,
      [key]: value,
    });
  };

  const positiveWeights = Object.entries(WEIGHT_METADATA)
    .filter(([, meta]) => meta.type === 'positive')
    .map(([key]) => key as keyof typeof WEIGHT_METADATA);

  const negativeWeights = Object.entries(WEIGHT_METADATA)
    .filter(([, meta]) => meta.type === 'negative')
    .map(([key]) => key as keyof typeof WEIGHT_METADATA);

  const renderSlider = (key: keyof typeof WEIGHT_METADATA) => {
    const meta = WEIGHT_METADATA[key];
    const value = weights[key as keyof WeightConfig] as number;
    const defaultValue = DEFAULT_WEIGHTS[key as keyof WeightConfig] as number;
    const isModified = Math.abs(value - defaultValue) > 0.01;

    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            {isZh ? meta.nameZh : meta.name}
          </label>
          <div className="flex items-center gap-2">
            {isModified && (
              <Badge variant="secondary" className="text-[10px]">
                {value > defaultValue ? '+' : ''}{(value - defaultValue).toFixed(1)}
              </Badge>
            )}
            <span
              className={cn(
                'text-sm font-mono w-12 text-right',
                meta.type === 'positive' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {value.toFixed(1)}
            </span>
          </div>
        </div>
        <Slider
          value={[value]}
          onValueChange={([v]) => handleWeightChange(key as keyof WeightConfig, v)}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          className={cn(
            '[&_[data-radix-slider-range]]:transition-colors',
            meta.type === 'positive'
              ? '[&_[data-radix-slider-range]]:bg-green-500 [&_[data-radix-slider-thumb]]:border-green-500'
              : '[&_[data-radix-slider-range]]:bg-red-500 [&_[data-radix-slider-thumb]]:border-red-500'
          )}
        />
        <p className="text-xs text-slate-500">
          {isZh ? meta.descriptionZh : meta.description}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Positive Weights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-green-500" />
            {t('weightLab.positiveWeights')}
            <Badge variant="positive">{positiveWeights.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {positiveWeights.map(renderSlider)}
        </CardContent>
      </Card>

      {/* Negative Weights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ThumbsDown className="w-5 h-5 text-red-500" />
            {t('weightLab.negativeWeights')}
            <Badge variant="negative">{negativeWeights.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {negativeWeights.map(renderSlider)}
        </CardContent>
      </Card>

      {/* Diversity Parameters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            {t('weightLab.diversityParams')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('weightLab.authorDiversityDecay')}
              </label>
              <span className="text-sm font-mono text-purple-600">
                {weights.authorDiversityDecay.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[weights.authorDiversityDecay]}
              onValueChange={([v]) => handleWeightChange('authorDiversityDecay', v)}
              min={0.1}
              max={1}
              step={0.05}
              className="[&_[data-radix-slider-range]]:bg-purple-500 [&_[data-radix-slider-thumb]]:border-purple-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('weightLab.authorDiversityFloor')}
              </label>
              <span className="text-sm font-mono text-purple-600">
                {weights.authorDiversityFloor.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[weights.authorDiversityFloor]}
              onValueChange={([v]) => handleWeightChange('authorDiversityFloor', v)}
              min={0}
              max={0.5}
              step={0.05}
              className="[&_[data-radix-slider-range]]:bg-purple-500 [&_[data-radix-slider-thumb]]:border-purple-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* OON Parameters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            {t('weightLab.oonParams')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('weightLab.oonWeightFactor')}
              </label>
              <span className="text-sm font-mono text-blue-600">
                {weights.oonWeightFactor.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[weights.oonWeightFactor]}
              onValueChange={([v]) => handleWeightChange('oonWeightFactor', v)}
              min={0.1}
              max={1}
              step={0.05}
            />
            <p className="text-xs text-slate-500">
              {isZh
                ? '关注外内容的权重乘数（1 = 与关注内相同）'
                : 'Multiplier for out-of-network content (1 = same as in-network)'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
