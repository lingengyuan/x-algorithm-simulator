import { useState } from 'react';
import { TweetInput } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Image, Video, FileX, Sparkles } from 'lucide-react';

interface InputFormProps {
  onAnalyze: (input: TweetInput) => void;
  initialValue?: TweetInput;
}

export function InputForm({ onAnalyze, initialValue }: InputFormProps) {
  const { t } = useTranslation();

  const [content, setContent] = useState(initialValue?.content || '');
  const [hasMedia, setHasMedia] = useState<'none' | 'image' | 'video'>(
    initialValue?.hasMedia || 'none'
  );
  const [videoDuration, setVideoDuration] = useState(
    initialValue?.videoDurationMs ? initialValue.videoDurationMs / 1000 : 30
  );
  const [authorType, setAuthorType] = useState<'normal' | 'verified' | 'influencer'>(
    initialValue?.authorType || 'normal'
  );
  const [followerCount, setFollowerCount] = useState(
    initialValue?.followerCount || 10000
  );

  const handleSubmit = () => {
    if (!content.trim()) return;

    onAnalyze({
      content: content.trim(),
      hasMedia,
      videoDurationMs: hasMedia === 'video' ? videoDuration * 1000 : undefined,
      authorType,
      followerCount,
    });
  };

  const formatFollowerCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sky-600" />
          {t('analyzer.title')}
        </CardTitle>
        <p className="text-sm text-slate-600">{t('analyzer.subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tweet Content */}
        <div className="space-y-2">
          <Textarea
            placeholder={t('analyzer.inputPlaceholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
            maxLength={280}
          />
          <div className="flex justify-end text-xs text-slate-500">
            {content.length}/280
          </div>
        </div>

        {/* Media Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            {t('analyzer.mediaType')}
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={hasMedia === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasMedia('none')}
              className="flex-1"
            >
              <FileX className="w-4 h-4 mr-2" />
              {t('analyzer.noMedia')}
            </Button>
            <Button
              type="button"
              variant={hasMedia === 'image' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasMedia('image')}
              className="flex-1"
            >
              <Image className="w-4 h-4 mr-2" />
              {t('analyzer.image')}
            </Button>
            <Button
              type="button"
              variant={hasMedia === 'video' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasMedia('video')}
              className="flex-1"
            >
              <Video className="w-4 h-4 mr-2" />
              {t('analyzer.video')}
            </Button>
          </div>
        </div>

        {/* Video Duration */}
        {hasMedia === 'video' && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('analyzer.videoDuration')}
              </label>
              <span className="text-sm text-slate-600">{videoDuration}s</span>
            </div>
            <Slider
              value={[videoDuration]}
              onValueChange={([value]) => setVideoDuration(value)}
              min={5}
              max={300}
              step={5}
            />
          </div>
        )}

        {/* Author Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            {t('analyzer.authorType')}
          </label>
          <Select value={authorType} onValueChange={(v) => setAuthorType(v as typeof authorType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t('analyzer.normalUser')}</SelectItem>
              <SelectItem value="verified">{t('analyzer.verifiedUser')}</SelectItem>
              <SelectItem value="influencer">{t('analyzer.influencer')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Follower Count */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-slate-700">
              {t('analyzer.followerCount')}
            </label>
            <span className="text-sm text-slate-600">
              {formatFollowerCount(followerCount)}
            </span>
          </div>
          <Slider
            value={[Math.log10(followerCount + 1)]}
            onValueChange={([value]) => setFollowerCount(Math.max(0, Math.round(Math.pow(10, value) - 1)))}
            min={0}
            max={7}
            step={0.1}
          />
        </div>

        {/* Analyze Button */}
        <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!content.trim()}>
          <Sparkles className="w-4 h-4 mr-2" />
          {t('analyzer.analyzeButton')}
        </Button>
      </CardContent>
    </Card>
  );
}
