import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import {
  Button,
  Dialog,
  Icon,
  LinkButton,
  MessageBar,
  useAnnouncer,
  useReveal,
} from '../../design/index.ts';
import { errorMessage } from '../../lib/api.ts';
import { SCENARIO_LIST, repeatLink } from './brief-href.ts';
import { jumpToSection } from './dom.ts';
import { Section } from './parts.tsx';
import { stagger } from './reveal.ts';
import type { ScenarioIndex } from './scenario-index.ts';
import type { ReportClient } from './useReportSession.ts';
import './report.css';

/**
 * "Delete this call": asks first, says what goes, and only then deletes. The call and its report live
 * on this device, so deleting removes them from it. If deleting fails the dialog stays open with the
 * reason and the same button to try again.
 */
export function DeleteCall({ sessionId, client }: { sessionId: string; client: ReportClient }) {
  const navigate = useNavigate();
  const announce = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setError(null);
  };

  const remove = () => {
    setDeleting(true);
    setError(null);
    client
      .deleteSession(sessionId)
      .then(() => {
        announce('The call was deleted.');
        void navigate(SCENARIO_LIST);
      })
      .catch((failure: unknown) => {
        setError(errorMessage(failure));
        setDeleting(false);
      });
  };

  return (
    <>
      <Button appearance="outline" icon="trash" onClick={() => setOpen(true)}>
        Delete this call
      </Button>
      <Dialog
        open={open}
        onClose={close}
        size="sm"
        title="Delete this call?"
        description="The transcript and the coaching report for this call are removed from this device. This cannot be undone."
        actions={
          <>
            <Button appearance="secondary" onClick={close} disabled={deleting} data-autofocus>
              Cancel
            </Button>
            <Button
              appearance="danger"
              icon="trash"
              loading={deleting}
              loadingLabel="Deleting the call"
              onClick={remove}
            >
              Delete call
            </Button>
          </>
        }
      >
        {error ? (
          <MessageBar intent="error" title="The call was not deleted">
            {error} Nothing was removed. You can try again.
          </MessageBar>
        ) : null}
      </Dialog>
    </>
  );
}

/**
 * The next moves: another call, the same scenario again, the whole transcript, a printout or home.
 * If the scenario of this call no longer exists, "Repeat scenario" opens the scenario list and says
 * why, rather than leading to a page that is not there. Deleting the call sits apart, below. There
 * is no share or export: nothing here sends the report anywhere, so none is offered.
 */
export function Actions({
  session,
  client,
  index,
  onPrint,
}: {
  session: SessionDTO;
  client: ReportClient;
  index: ScenarioIndex;
  onPrint: () => void;
}) {
  const repeat = repeatLink(session, index);
  const note = useId();
  const [ref, reveal] = useReveal<HTMLDivElement>();
  return (
    <Section id="actions" title="Actions">
      <div className="rp-actions" ref={ref} {...reveal} style={stagger(1)}>
        <LinkButton to={SCENARIO_LIST} appearance="primary" icon="phone">
          Try another call
        </LinkButton>
        <LinkButton
          to={repeat.to}
          icon="refresh"
          aria-describedby={repeat.available ? undefined : note}
        >
          Repeat scenario
        </LinkButton>
        <Button icon="document" onClick={() => jumpToSection('transcript')}>
          Review full transcript
        </Button>
        <Button icon="print" onClick={onPrint}>
          Print report
        </Button>
        <LinkButton to="/" appearance="subtle" icon="home">
          Return home
        </LinkButton>
      </div>
      {repeat.available ? null : (
        <p id={note} className="rp-actions__note" {...reveal} style={stagger(2)}>
          <Icon name="info" size={16} />
          <span>
            This scenario is no longer available, so Repeat scenario opens the scenario list.
          </span>
        </p>
      )}
      <div className="rp-actions rp-actions--danger" {...reveal} style={stagger(3)}>
        <DeleteCall sessionId={session.id} client={client} />
      </div>
    </Section>
  );
}
