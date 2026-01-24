import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/hooks/useI18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { TweetAnalyzer } from '@/components/TweetAnalyzer';
import { RankingSimulator } from '@/components/RankingSimulator';
import { WeightLab } from '@/components/WeightLab';
import { HistoryList } from '@/components/History/HistoryList';

function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<TweetAnalyzer />} />
                <Route path="simulator" element={<ErrorBoundary><RankingSimulator /></ErrorBoundary>} />
                <Route path="weights" element={<ErrorBoundary><WeightLab /></ErrorBoundary>} />
                <Route path="history" element={<HistoryList />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
