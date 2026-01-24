import { TweetCandidate } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TweetCard } from '@/components/shared/TweetCard';
import { Users, Globe, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CandidatePoolProps {
  candidates: TweetCandidate[];
  filteredCount?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  showFiltered?: boolean;
}

export function CandidatePool({
  candidates,
  filteredCount = 0,
  selectedId,
  onSelect,
  showFiltered = false,
}: CandidatePoolProps) {
  const { t } = useTranslation();

  const inNetworkCount = candidates.filter((c) => c.inNetwork && !c.filtered).length;
  const outNetworkCount = candidates.filter((c) => !c.inNetwork && !c.filtered).length;
  const activeCount = candidates.filter((c) => !c.filtered).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-[#1DA1F2]" />
          {t('simulator.candidatePool')}
        </CardTitle>
        <div className="flex gap-2 flex-wrap mt-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="w-3 h-3" />
            {activeCount} {t('simulator.tweets')}
          </Badge>
          <Badge variant="positive" className="gap-1">
            <Users className="w-3 h-3" />
            {t('simulator.inNetwork')}: {inNetworkCount}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Globe className="w-3 h-3" />
            {t('simulator.outOfNetwork')}: {outNetworkCount}
          </Badge>
          {filteredCount > 0 && (
            <Badge variant="negative" className="gap-1">
              <Filter className="w-3 h-3" />
              {t('simulator.filtered')}: {filteredCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
          <AnimatePresence mode="popLayout">
            {candidates
              .filter((c) => showFiltered || !c.filtered)
              .map((candidate, index) => (
                <motion.div
                  key={candidate.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, x: -50 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                >
                  <TweetCard
                    tweet={candidate}
                    compact
                    highlighted={candidate.id === selectedId}
                    showFiltered={showFiltered}
                    onClick={() => onSelect?.(candidate.id)}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
