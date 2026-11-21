import { useParams } from 'react-router';
import { ReportPage } from '../features/report/ReportPage.tsx';

/** `/sessions/:id/report`: the evaluation under way, a failure to recover from, or the coaching report. */
export default function Report() {
  const { id = '' } = useParams();
  return <ReportPage key={id} sessionId={id} />;
}
