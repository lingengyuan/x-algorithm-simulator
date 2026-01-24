import { AnalysisHistory, WeightConfig } from '@/core/types';

const STORAGE_KEYS = {
  HISTORY: 'x-simulator-history',
  WEIGHTS: 'x-simulator-weights',
  LANGUAGE: 'x-simulator-language',
};

const MAX_HISTORY_ITEMS = 50;

// History storage
export function getHistory(): AnalysisHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: AnalysisHistory): void {
  try {
    let histories = getHistory();
    histories.unshift(history);

    // Keep only the most recent items
    if (histories.length > MAX_HISTORY_ITEMS) {
      histories = histories.slice(0, MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(histories));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

export function deleteHistoryItem(id: string): void {
  try {
    const histories = getHistory().filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(histories));
  } catch (error) {
    console.error('Failed to delete history item:', error);
  }
}

// Weight presets storage
export function getSavedWeights(): Record<string, WeightConfig> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WEIGHTS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveWeightPreset(name: string, weights: WeightConfig): void {
  try {
    const presets = getSavedWeights();
    presets[name] = weights;
    localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save weight preset:', error);
  }
}

export function deleteWeightPreset(name: string): void {
  try {
    const presets = getSavedWeights();
    delete presets[name];
    localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to delete weight preset:', error);
  }
}

// Language preference
export function getLanguage(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'en';
  } catch {
    return 'en';
  }
}

export function setLanguage(lang: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch (error) {
    console.error('Failed to save language:', error);
  }
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
