import type { TweetCandidate } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TweetCard } from '@/components/shared/TweetCard';

interface CandidatePoolProps {
  candidates: TweetCandidate[];
  filteredCount?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  showFiltered?: boolean;
}

export function CandidatePool({ candidates, filteredCount = 0, selectedId, onSelect, showFiltered = false }: CandidatePoolProps) {
  const { t, isZh } = useTranslation();
  const active = candidates.filter((candidate) => showFiltered || !candidate.filtered);
  const inNetwork = active.filter((candidate) => candidate.inNetwork === true).length;
  const outNetwork = active.filter((candidate) => candidate.inNetwork === false).length;
  return <Card>
    <CardHeader>
      <CardTitle>{t('simulator.candidatePool')} <span className="text-sm font-normal text-slate-600">{active.length.toLocaleString()}</span></CardTitle>
      <div className="pool-stats">
        <span>{t('simulator.inNetwork')} <strong>{inNetwork}</strong></span>
        <span>{t('simulator.outOfNetwork')} <strong>{outNetwork}</strong></span>
        {filteredCount > 0 && <span>{t('simulator.filtered')} <strong>{filteredCount.toLocaleString()}</strong></span>}
      </div>
    </CardHeader>
    <CardContent>
      <div className="post-list">
        {active.slice(0, 48).map((candidate, index) => <TweetCard
          key={`${candidate.sourceType}:${candidate.id}:${index}`} tweet={candidate} compact
          highlighted={candidate.id === selectedId} showFiltered={showFiltered} onClick={() => onSelect?.(candidate.id)} />)}
        {!active.length && <p className="pipeline-empty">{isZh ? '当前阶段没有候选帖子。' : 'No candidates remain at this stage.'}</p>}
      </div>
      {active.length > 48 && <p className="field-note">{isZh ? `预览前 48 条，共 ${active.length.toLocaleString()} 条。导出的流程数据包含完整候选池。` : `Previewing 48 of ${active.length.toLocaleString()} posts. The exported trace contains the full pool.`}</p>}
    </CardContent>
  </Card>;
}
