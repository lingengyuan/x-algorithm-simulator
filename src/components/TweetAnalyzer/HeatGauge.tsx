import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useI18n';
import { getHeatLevel } from '@/utils/scoring';
import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeatGaugeProps {
  score: number;
}

export function HeatGauge({ score }: HeatGaugeProps) {
  const { t, isZh } = useTranslation();

  const heatLevel = useMemo(() => getHeatLevel(score), [score]);
  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="w-5 h-5" style={{ color: heatLevel.color }} />
          {t('analyzer.heatScore')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Gauge SVG */}
          <div className="relative w-48 h-28">
            <svg viewBox="0 0 200 110" className="w-full h-full">
              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Colored gradient arc */}
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22C55E" />
                  <stop offset="50%" stopColor="#EAB308" />
                  <stop offset="75%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
              </defs>

              {/* Progress arc */}
              <motion.path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="16"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: score / 100 }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />

              {/* Needle */}
              <motion.g
                initial={{ rotate: -90 }}
                animate={{ rotate: rotation }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{ transformOrigin: '100px 100px' }}
              >
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="35"
                  stroke="#0f172a"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="100" r="8" fill="#0f172a" />
              </motion.g>

              {/* Labels */}
              <text x="25" y="108" fontSize="12" fill="#9ca3af">
                0
              </text>
              <text x="170" y="108" fontSize="12" fill="#9ca3af">
                100
              </text>
            </svg>
          </div>

          {/* Score display */}
          <motion.div
            className="text-center mt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="text-4xl font-bold" style={{ color: heatLevel.color }}>
              {Math.round(score)}
            </div>
            <div
              className="text-sm font-medium mt-1 px-3 py-1 rounded-full"
              style={{
                backgroundColor: `${heatLevel.color}20`,
                color: heatLevel.color,
              }}
            >
              {isZh ? heatLevel.labelZh : heatLevel.label}
            </div>
          </motion.div>

          {/* Scale reference */}
          <div className="flex justify-between w-full mt-4 text-xs text-slate-500">
            <span>{t('heatLevel.low')}</span>
            <span>{t('heatLevel.medium')}</span>
            <span>{t('heatLevel.high')}</span>
            <span>{t('heatLevel.viral')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
