import { useState, useRef, useCallback } from 'react';
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
import { SlidersHorizontal, RotateCcw, Save, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function WeightLab() {
  const { t } = useTranslation();

  const normalizeWeights = (value: Partial<WeightConfig>): WeightConfig => ({
    ...DEFAULT_WEIGHTS,
    ...value,
  });

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

  const [weights, setWeights] = useState<WeightConfig>({ ...DEFAULT_WEIGHTS });
  const [previousWeights, setPreviousWeights] = useState<WeightConfig | undefined>();
  const [candidates] = useState<TweetCandidate[]>(bootstrap.candidates);
  const [presets, setPresets] = useState<Record<string, WeightConfig>>(bootstrap.presets);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [error] = useState<string | null>(bootstrap.error);

  const debounceRef = useRef<number | null>(null);

  // Handle weight change with debounce
  const handleWeightChange = useCallback((newWeights: WeightConfig) => {
    // Store previous weights for comparison
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      setPreviousWeights(weights);
    }, 500);

    setWeights(newWeights);
  }, [weights]);

  // Reset to defaults
  const handleReset = () => {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Live Tuning
          </p>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2 text-slate-900">
            <SlidersHorizontal className="w-6 h-6 text-sky-600" />
            {t('weightLab.title')}
          </h1>
          <p className="text-slate-600 text-sm mt-1">{t('weightLab.subtitle')}</p>
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
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}

          {/* Save Preset */}
          {showSaveInput ? (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
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
            </motion.div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Weight Sliders */}
        <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
          <WeightSliders weights={weights} onChange={handleWeightChange} />
        </div>

        {/* Right Column - Live Ranking */}
        <div>
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
