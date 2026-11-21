import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { Button, Dialog, LinkButton, MessageBar, useAnnouncer } from '../../design/index.ts';
import { errorMessage } from '../../lib/api.ts';
import { toBriefHref } from './brief-href.ts';
import { jumpToSection } from './dom.ts';
import { Section } from './parts.tsx';
import type { ReportClient } from './useReportSession.ts';

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
        void navigate('/scenarios');
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

/** The next moves: another scenario, the same one again, the transcript, a printout, home or deleting the call. */
export function Actions({
  session,
  client,
  onPrint,
}: {
  session: SessionDTO;
  client: ReportClient;
  onPrint: () => void;
}) {
  return (
    <Section id="actions" title="Actions" lead="Choose what to do with this call.">
      <div className="rp-actions">
        <LinkButton to="/scenarios" icon="list">
          Try another scenario
        </LinkButton>
        <LinkButton to={toBriefHref(session)} icon="refresh">
          Repeat this scenario
        </LinkButton>
        <Button icon="document" onClick={() => jumpToSection('transcript')}>
          Review transcript
        </Button>
        <Button icon="print" onClick={onPrint}>
          Print report
        </Button>
        <LinkButton to="/" icon="home">
          Return home
        </LinkButton>
      </div>
      <div className="rp-actions rp-actions--danger">
        <DeleteCall sessionId={session.id} client={client} />
      </div>
    </Section>
  );
}
