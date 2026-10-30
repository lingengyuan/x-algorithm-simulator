import { useState, useRef, useCallback, useEffect } from 'react';
import { TweetCandidate, WeightConfig } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeightSliders } from './WeightSliders';
import { LiveRanking } from './LiveRanking';
import { DEFAULT_WEIGHTS } from '@/data/defaultWeights';
import { generateMockTweets } from '@/data/mockTweets';
import { getSavedWeights, saveWeightPreset, deleteWeightPreset } from '@/utils/storage';
import { RotateCcw, Save, Trash2 } from 'lucide-react';

export function WeightLab() {
  const { t, isZh } = useTranslation();

  const normalizeWeights = (value: Partial<WeightConfig>): WeightConfig => {
    const stored = value as Partial<WeightConfig> & { reactWithVideoWeight?: number };
    const {
      reactWithVideoWeight: legacyPostVideoWeight,
      ...currentWeights
    } = stored;

    return {
      ...DEFAULT_WEIGHTS,
      ...currentWeights,
      postVideoWeight: currentWeights.postVideoWeight ??
        legacyPostVideoWeight ??
        DEFAULT_WEIGHTS.postVideoWeight,
    };
  };

  const [bootstrap] = useState(() => {
    try {
      const mockCandidates = generateMockTweets(30, 0.5);
      const savedPresetsRaw = getSavedWeights();
      const savedPresets = Object.fromEntries(
        Object.entries(savedPresetsRaw).map(([name, preset]) => [
          name,
          normalizeWeights(preset),
        ])
      );

      return {
        candidates: mockCandidates,
        presets: savedPresets,
        error: null as string | null,
      };
    } catch (err) {
      console.error('Failed to initialize WeightLab:', err);
      return {
        candidates: [] as TweetCandidate[],
        presets: {} as Record<string, WeightConfig>,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });

  const [activeView, setActiveView] = useState('weights');
  const [weights, setWeights] = useState<WeightConfig>({ ...DEFAULT_WEIGHTS });
  const [previousWeights, setPreviousWeights] = useState<WeightConfig | undefined>();
  const [candidates] = useState<TweetCandidate[]>(bootstrap.candidates);
  const [presets, setPresets] = useState<Record<string, WeightConfig>>(bootstrap.presets);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [error] = useState<string | null>(bootstrap.error);

  const debounceRef = useRef<number | null>(null);

  const clearComparisonWindow = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => clearComparisonWindow, [clearComparisonWindow]);

  // Keep the weights from the start of one slider gesture as the comparison baseline.
  const handleWeightChange = useCallback((newWeights: WeightConfig) => {
    if (debounceRef.current === null) {
      setPreviousWeights(weights);
    } else {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
    }, 500);

    setWeights(newWeights);
  }, [weights]);

  // Reset to defaults
  const handleReset = () => {
    clearComparisonWindow();
    setPreviousWeights(weights);
    setWeights({ ...DEFAULT_WEIGHTS });
    setSelectedPreset('');
  };

  // Save preset
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;

    saveWeightPreset(newPresetName.trim(), weights);
    setPresets((prev) => ({
      ...prev,
      [newPresetName.trim()]: weights,
    }));
    setNewPresetName('');
    setShowSaveInput(false);
    setSelectedPreset(newPresetName.trim());
  };

  // Load preset
  const handleLoadPreset = (name: string) => {
    const preset = presets[name];
    if (preset) {
      clearComparisonWindow();
      setPreviousWeights(weights);
      setWeights(normalizeWeights(preset));
      setSelectedPreset(name);
    }
  };

  // Delete preset
  const handleDeletePreset = (name: string) => {
    deleteWeightPreset(name);
    setPresets((prev) => {
      const newPresets = { ...prev };
      delete newPresets[name];
      return newPresets;
    });
    if (selectedPreset === name) {
      setSelectedPreset('');
    }
  };

  // Show error if any
  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-4">Error</h2>
        <p className="mb-4 text-slate-600">{error}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2 text-slate-900">

            {t('weightLab.title')}
          </h1>
          <p className="text-slate-600 text-sm mt-1">{t('weightLab.subtitle')}</p>
          <p className="mt-2 max-w-xl text-xs text-slate-500">
            {isZh ? '编辑 Home Mixer 加权参数。VMRanker 复用该加权分，再应用多样性、关注外系数和 DPP。' : 'Edit Home Mixer fusion weights. VMRanker reuses the weighted score, then applies diversity, OON, and DPP.'}
          </p>
        </div>

        {/* Preset Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Load Preset */}
          {Object.keys(presets).length > 0 && (
            <Select value={selectedPreset} onValueChange={handleLoadPreset}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('weightLab.loadPreset')} />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(presets).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Delete Preset */}
          {selectedPreset && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleDeletePreset(selectedPreset)}
              aria-label={isZh ? '删除预设' : 'Delete preset'}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}

          {/* Save Preset */}
          {showSaveInput ? (
            <div
              className="flex items-center gap-2"
            >
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t('weightLab.presetName')}
                className="w-32"
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              />
              <Button size="sm" onClick={handleSavePreset}>
                {t('common.save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSaveInput(false)}
              >
                {t('common.close')}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowSaveInput(true)}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {t('weightLab.savePreset')}
            </Button>
          )}

          {/* Reset Button */}
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            {t('weightLab.resetToDefault')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="workspace-tabs weight-view-tabs" role="tablist" aria-label={isZh ? '权重工作区视图' : 'Weight workspace view'}>
        <button role="tab" aria-selected={activeView === 'weights'} aria-controls="weight-controls" onClick={() => setActiveView('weights')}>{isZh ? '权重参数' : 'Weights'}</button>
        <button role="tab" aria-selected={activeView === 'ranking'} aria-controls="weight-ranking" onClick={() => setActiveView('ranking')}>{t('weightLab.liveRanking')}</button>
      </div>
      <div className="weight-workbench">
        {/* Left Column - Weight Sliders */}
        <div className="weight-controls space-y-4" id="weight-controls" data-active={activeView === 'weights'}>
          <WeightSliders weights={weights} onChange={handleWeightChange} />
        </div>

        {/* Right Column - Live Ranking */}
        <div className="weight-ranking" id="weight-ranking" data-active={activeView === 'ranking'}>
          <LiveRanking
            candidates={candidates}
            weights={weights}
            previousWeights={previousWeights}
          />
        </div>
      </div>
    </div>
  );
}
