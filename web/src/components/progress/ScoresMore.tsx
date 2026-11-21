import { useMemo } from 'react';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { Disclosure } from '../frame/index.ts';
import { ScoresTable } from './ScoresTable.tsx';
import { orderedTrends } from './progress-model.ts';
import '../../styles/progress.css';

/**
 * The same scores as a table, for anyone who would rather read figures than stars. It sits below the
 * sky and its panel and not inside their grid: the sky is sticky, and a sticky box in a grid slides to
 * the bottom of the whole grid, over whatever was put under it.
 */
export function ScoresMore({ progress }: { progress: Pick<ProgressDTO, 'dimensionTrends'> }) {
  const trends = useMemo(() => orderedTrends(progress.dimensionTrends), [progress.dimensionTrends]);
  return (
    <div className="pg-more">
      <Disclosure summary="Scores as a table">
        <ScoresTable trends={trends} />
      </Disclosure>
    </div>
  );
}
