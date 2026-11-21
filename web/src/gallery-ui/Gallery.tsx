import { useState } from 'react';
import { ApiError } from '../lib/api.ts';
import { useAmbient } from '../lib/motion/ambient.tsx';
import { useTheme, type ThemePreference } from '../lib/theme.tsx';
import { useToast } from '../lib/toast.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { Icon } from '../components/Icon.tsx';
import {
  ChoiceRow,
  Disclosure,
  EmptyNotice,
  ErrorNotice,
  Field,
  Ledger,
  LoadingNotice,
  NotFoundNotice,
  PageFrame,
  PageHead,
  Section,
  SelectInput,
  Stat,
  StatRow,
  TabRow,
  Tag,
  TextArea,
  TextInput,
  Toggle,
  tabDomId,
  tabPanelDomId,
} from '../components/frame/index.ts';
import { Strands } from './Strands.tsx';
import { PageDemo } from './PageDemo.tsx';
import './gallery.css';

const IMPACT = [
  { value: 'low', label: 'Low', hint: 'One person is affected and there is a workaround.' },
  { value: 'medium', label: 'Medium', hint: 'A team is slowed down and a deadline is in sight.' },
  { value: 'high', label: 'High', hint: 'The business is losing time or money right now.' },
];
const TEMPERATURE = [
  { value: 'calm', label: 'Calm', hint: 'Open to a clear explanation.' },
  { value: 'anxious', label: 'Anxious', hint: 'Needs reassurance before detail.' },
  { value: 'frustrated', label: 'Frustrated', hint: 'Short with you. Has already tried things.' },
  { value: 'angry', label: 'Angry', hint: 'Patience is gone. Every delay lands badly.' },
];
const FAMILY = [
  { value: 'access', label: 'Access and identity' },
  { value: 'billing', label: 'Billing and licensing' },
  { value: 'data', label: 'Data and recovery' },
  { value: 'guidance', label: 'Guidance and how-to' },
  { value: 'performance', label: 'Performance' },
  { value: 'availability', label: 'Service availability' },
  { value: 'unexpected', label: 'Unexpected behaviour', disabled: true },
];
const STYLE = [
  { value: 'guided', label: 'Guided', hint: 'Cues about the customer appear as the call goes.' },
  { value: 'immersive', label: 'Immersive', hint: 'No cues, as in a real call.' },
];
const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences', count: 4 },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Data and privacy', count: 12 },
  { id: 'about', label: 'About this practice space' },
];
const SELECT = [
  { value: 'starter', label: 'Starter' },
  { value: 'standard', label: 'Standard' },
  { value: 'challenge', label: 'Challenge' },
];
const NETWORK_ERROR = new ApiError(
  0,
  'network',
  "Can't reach Firefly right now. Check that the server is running, then try again.",
  true,
);
const MISSING_ERROR = new ApiError(404, 'not_found', 'That call no longer exists.', false);
const LONG_WORD = 'Supercalifragilisticexpialidocious-and-then-some-more-letters-without-a-break';

type Backdrop = 'plain' | 'strands' | 'live';
type DialogKind = null | 'dialog' | 'sheet' | 'drawer' | 'confirm' | 'tall';
const query = new URLSearchParams(window.location.search);

export function Gallery() {
  const { theme, setTheme, motion, setMotion } = useTheme();
  const ambient = useAmbient();
  const { toast } = useToast();
  const [backdrop, setBackdrop] = useState<Backdrop>(
    (['plain', 'strands', 'live'] as const).find((value) => value === query.get('bg')) ?? 'plain',
  );
  const [impact, setImpact] = useState('medium');
  const [temperature, setTemperature] = useState('frustrated');
  const [difficulty, setDifficulty] = useState('standard');
  const [style, setStyle] = useState('guided');
  const [family, setFamily] = useState('performance');
  const [tab, setTab] = useState('preferences');
  const [tools, setTools] = useState(true);
  const [sound, setSound] = useState(false);
  const [name, setName] = useState('Sam Rivera');
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState('');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const width = Number(query.get('w')) || undefined;

  if (query.get('view') === 'page') {
    return (
      <>
        <div className="world" aria-hidden="true" />
        {backdrop !== 'plain' ? <Strands live={backdrop === 'live'} /> : null}
        <main id="main" className="gallery" tabIndex={-1}>
          <PageDemo />
        </main>
      </>
    );
  }

  return (
    <>
      <div className="world" aria-hidden="true" />
      {backdrop !== 'plain' ? <Strands live={backdrop === 'live'} /> : null}
      <main id="main" className="gallery" style={width ? { maxWidth: width } : undefined}>
        <PageFrame title="UI gallery" width="wide">
          <PageHead
            eyebrow="Plate 00 / Primitives"
            title="One language for every page"
            lead="Every shared primitive in every state. Hairlines, type, ticks and one amber point do the work that boxes do elsewhere."
            actions={
              <>
                <a className="action" href="#actions">
                  Jump to actions
                  <Icon name="arrow-right" size={18} />
                </a>
                <a className="text-link" href="#environment">
                  Environment
                </a>
              </>
            }
          />

          <Section id="actions" eyebrow="01" title="Actions">
            <div className="gallery-demo">
              <div className="action-row">
                <button type="button" className="action">
                  Enter the call
                  <Icon name="arrow-right" size={18} />
                </button>
                <button type="button" className="action action--quiet">
                  Save draft
                </button>
                <button type="button" className="action action--danger">
                  Discard call
                </button>
                <button type="button" className="text-link">
                  Back to the plate
                </button>
                <a className="text-link" href="#actions">
                  Responsible AI
                </a>
              </div>
              <div className="action-row">
                <button type="button" className="action" disabled>
                  Disabled
                  <Icon name="arrow-right" size={18} />
                </button>
                <button type="button" className="action action--quiet" disabled>
                  Disabled quiet
                </button>
                <a className="action action--quiet" href="#actions" aria-disabled="true">
                  Disabled link
                </a>
                <button type="button" className="action action--compact">
                  Compact
                </button>
                <button
                  type="button"
                  className="action action--quiet action--icon"
                  aria-label="Copy"
                >
                  <Icon name="copy" size={18} />
                </button>
                <button type="button" className="action" aria-busy="true">
                  Ending call…
                </button>
              </div>
              <div className="action-row">
                <button type="button" className="action" style={{ maxWidth: '16rem' }}>
                  A very long label that has to wrap onto a second line without breaking anything
                </button>
                <button type="button" className="action action--quiet">
                  {LONG_WORD.slice(0, 40)}
                </button>
              </div>
            </div>
          </Section>

          <Section
            id="heads"
            eyebrow="02"
            title="Page head and section"
            aside={
              <a className="text-link" href="#heads">
                View all
              </a>
            }
          >
            <div className="gallery-demo">
              <PageHead
                level={2}
                as="div"
                eyebrow="Plate II / Signal 06"
                title="Team cannot open the shared project workspace"
                lead="Daniel Osei, project lead, Proseware Consulting. Practises empathy, de-escalation and ownership of next steps."
                actions={
                  <button type="button" className="action action--quiet">
                    Back to the plate
                  </button>
                }
              />
              <PageHead
                level={2}
                as="div"
                title={`A title with a word that never ends: ${LONG_WORD}`}
              />
            </div>
          </Section>

          <Section id="choices" eyebrow="03" title="Choice rows">
            <div className="gallery-demo">
              <ChoiceRow
                legend="Impact"
                name="g-impact"
                value={impact}
                options={IMPACT}
                onChange={setImpact}
              />
              <ChoiceRow
                legend="Customer temperature"
                name="g-temperature"
                value={temperature}
                options={TEMPERATURE}
                onChange={setTemperature}
              />
              <ChoiceRow
                legend="Difficulty"
                name="g-difficulty"
                value={difficulty}
                options={SELECT.map((option) => ({
                  ...option,
                  hint: `${option.label} threads, hidden to different depths.`,
                }))}
                onChange={setDifficulty}
              />
              <ChoiceRow
                legend="Practice style"
                name="g-style"
                size="text"
                value={style}
                options={STYLE}
                onChange={setStyle}
              />
              <ChoiceRow
                legend="Issue family (a long row that wraps, one option unavailable)"
                name="g-family"
                size="text"
                value={family}
                options={FAMILY}
                onChange={setFamily}
              />
            </div>
          </Section>

          <Section id="tabs" eyebrow="04" title="Tabs">
            <div className="gallery-demo">
              <TabRow
                label="Settings"
                tabs={TABS}
                active={tab}
                onChange={setTab}
                panelId="g-tabs"
              />
              <div
                role="tabpanel"
                id={tabPanelDomId('g-tabs', tab)}
                aria-labelledby={tabDomId('g-tabs', tab)}
                tabIndex={0}
              >
                <p className="type-read">Showing {TABS.find((item) => item.id === tab)?.label}.</p>
              </div>
            </div>
          </Section>

          <Section id="toggles" eyebrow="05" title="Toggles">
            <div className="gallery-demo">
              <div className="ff-rows">
                <Toggle
                  checked={tools}
                  onChange={setTools}
                  label="Show hints while I practise"
                  hint="Hints only fill the reply box. You still choose what to send."
                />
                <Toggle checked={sound} onChange={setSound} label="Sound" />
                <Toggle
                  checked
                  label="Always on, and cannot be changed"
                  hint="Required for the practice call to work."
                  disabled
                  onChange={() => undefined}
                />
                <Toggle
                  checked={false}
                  label="Unavailable here"
                  disabled
                  onChange={() => undefined}
                />
                <Toggle
                  checked={sound}
                  onChange={setSound}
                  label={`A label with a long word ${LONG_WORD}`}
                />
              </div>
            </div>
          </Section>

          <Section id="fields" eyebrow="06" title="Fields">
            <div className="gallery-demo gallery-demo--two">
              <Field label="Display name" hint="Shown on this device only.">
                <TextInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  autoComplete="off"
                />
              </Field>
              <Field label="Email" error="Enter an address like name@example.com.">
                <TextInput type="email" defaultValue="sam@" />
              </Field>
              <Field label="Starting difficulty">
                <SelectInput options={SELECT} defaultValue="standard" />
              </Field>
              <Field label="Disabled field">
                <TextInput defaultValue="Cannot be edited" disabled />
              </Field>
              <Field label="Your reply" hint="Enter sends. Shift and Enter adds a line.">
                <TextArea
                  serif
                  rows={2}
                  maxLength={240}
                  placeholder="Say what you would say."
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                />
              </Field>
              <Field label="Notes for the reviewer" error="Notes can be at most 600 characters.">
                <TextArea
                  maxLength={600}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section id="disclosure" eyebrow="07" title="Disclosure">
            <div className="gallery-stack">
              <Disclosure summary="How was this score worked out?">
                <p>
                  Each skill is scored from what was said, never from how it was said. Scores are
                  for practice, not performance reviews.
                </p>
              </Disclosure>
              <Disclosure summary="Report details and rubric" defaultOpen>
                <p>Open from the start. The tick turns from a plus into a minus.</p>
              </Disclosure>
              <Disclosure summary="Data and privacy">
                <p>Everything stays in this browser unless you export it.</p>
              </Disclosure>
            </div>
          </Section>

          <Section id="marks" eyebrow="08" title="Tags, figures and ledgers">
            <div className="gallery-demo">
              <div className="action-row">
                <Tag>Not started</Tag>
                <Tag tone="amber">Recommended</Tag>
                <Tag tone="aqua">Selected</Tag>
                <Tag tone="sage">Verified</Tag>
                <Tag tone="coral">Missed</Tag>
              </div>
              <StatRow>
                <Stat label="Calls completed" value="12" note="Since March" />
                <Stat label="Signals found" value="31" />
                <Stat label="Points" value="1,240" note="Points are not a ranking" />
              </StatRow>
              <Ledger
                rows={[
                  { label: 'Scenario', value: 'Team cannot open the shared project workspace' },
                  { label: 'Duration', value: '9 min 40 s', note: 'Scenario length is 10 minutes' },
                  { label: 'Practice style', value: 'Guided' },
                  { label: 'Turns', value: '14' },
                  { label: 'A label that is quite long and has to wrap', value: LONG_WORD },
                ]}
              />
            </div>
          </Section>

          <Section id="notices" eyebrow="09" title="Notices">
            <div className="gallery-demo gallery-demo--two">
              <EmptyNotice
                title="No calls yet"
                action={
                  <a className="action" href="#notices">
                    Start practice
                    <Icon name="arrow-right" size={18} />
                  </a>
                }
              >
                Your history starts with your first call. Nothing here is a sample.
              </EmptyNotice>
              <ErrorNotice error={NETWORK_ERROR} onRetry={() => toast({ title: 'Trying again' })} />
              <ErrorNotice error={MISSING_ERROR} title="We could not open this call" />
              <LoadingNotice label="Loading scenarios" />
              <LoadingNotice label="Loading your report" lines={6} />
            </div>
            <div className="gallery-preview">
              <NotFoundNotice />
            </div>
          </Section>

          <Section id="overlays" eyebrow="10" title="Dialog and toast">
            <div className="gallery-demo">
              <div className="action-row">
                <button
                  type="button"
                  className="action action--quiet"
                  onClick={() => setDialog('dialog')}
                >
                  Open dialog
                </button>
                <button
                  type="button"
                  className="action action--quiet"
                  onClick={() => setDialog('confirm')}
                >
                  Open confirmation
                </button>
                <button
                  type="button"
                  className="action action--quiet"
                  onClick={() => setDialog('sheet')}
                >
                  Open sheet
                </button>
                <button
                  type="button"
                  className="action action--quiet"
                  onClick={() => setDialog('drawer')}
                >
                  Open drawer
                </button>
                <button
                  type="button"
                  className="action action--quiet"
                  onClick={() => setDialog('tall')}
                >
                  Open long content
                </button>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => toast({ title: 'Copied to the clipboard' })}
                >
                  Toast: info
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    toast({
                      tone: 'positive',
                      title: 'Profile saved',
                      message: 'Your name now appears on this device only.',
                    })
                  }
                >
                  Toast: positive
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    toast({
                      tone: 'caution',
                      title: 'You are offline',
                      message: 'Your draft is kept in this browser.',
                    })
                  }
                >
                  Toast: caution
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    toast({
                      tone: 'negative',
                      title: 'Could not save',
                      message: 'Check your connection and try again.',
                    })
                  }
                >
                  Toast: negative
                </button>
              </div>
            </div>
          </Section>

          <Section id="environment" eyebrow="11" title="Environment">
            <div className="gallery-demo">
              <ChoiceRow
                legend="Theme"
                name="g-theme"
                size="text"
                value={theme}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' },
                ]}
                onChange={(value) => setTheme(value as ThemePreference)}
              />
              <ChoiceRow
                legend="Behind the page"
                name="g-backdrop"
                size="text"
                value={backdrop}
                options={[
                  { value: 'plain', label: 'Plain field' },
                  { value: 'strands', label: 'Strands' },
                  { value: 'live', label: 'Strands, moving' },
                ]}
                onChange={(value) => setBackdrop(value as Backdrop)}
              />
              <Toggle
                checked={motion === 'reduce'}
                onChange={(next) => setMotion(next ? 'reduce' : 'system')}
                label="Reduce motion"
              />
              <Toggle
                checked={ambient.paused}
                onChange={(next) => ambient.setPreference(next ? 'paused' : 'on')}
                label="Pause ambient motion"
                disabled={ambient.forced}
                hint={ambient.forced ? 'Reduced motion already pauses it.' : undefined}
              />
            </div>
          </Section>
        </PageFrame>
      </main>

      <Dialog
        open={dialog === 'dialog'}
        onClose={() => setDialog(null)}
        title="Practice settings"
        eyebrow="Plate II"
        description="Changes apply to your next call. The call you are in is not affected."
      >
        <div className="gallery-demo">
          <Toggle checked={tools} onChange={setTools} label="Show hints" />
          <Field label="Display name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="action-row">
            <button type="button" className="action" onClick={() => setDialog(null)} data-autofocus>
              Save
              <Icon name="arrow-right" size={18} />
            </button>
            <button type="button" className="text-link" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'confirm'}
        onClose={() => setDialog(null)}
        dismissible={false}
        title="Discard this call?"
        description="Nothing has been said yet, so there is nothing to coach. The call will be removed."
      >
        <div className="action-row">
          <button
            type="button"
            className="action action--quiet"
            onClick={() => setDialog(null)}
            data-autofocus
          >
            Keep talking
          </button>
          <button type="button" className="action action--danger" onClick={() => setDialog(null)}>
            <Icon name="trash" size={18} />
            Discard call
          </button>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'sheet'}
        onClose={() => setDialog(null)}
        variant="sheet"
        title="Call details"
      >
        <Ledger
          rows={[
            { label: 'Customer', value: 'Maya Okafor' },
            { label: 'Role', value: 'Front-desk coordinator, Fabrikam Dental Group' },
            { label: 'Practice style', value: 'Guided' },
          ]}
        />
      </Dialog>
      <Dialog
        open={dialog === 'tall'}
        onClose={() => setDialog(null)}
        eyebrow="Plate IV / Evaluator notes"
        title={`A title long enough to wrap, with ${LONG_WORD}`}
        description="The header stays in view while the body scrolls. Nothing is cut off at any width."
      >
        <Ledger
          rows={Array.from({ length: 30 }, (_, index) => ({
            label: `Row ${index + 1}`,
            value: index % 7 === 0 ? LONG_WORD : 'A value',
            note: index % 5 === 0 ? 'With a note under it' : undefined,
          }))}
        />
        <div className="action-row" style={{ marginBlockStart: 'var(--sp-5)' }}>
          <button type="button" className="action" onClick={() => setDialog(null)}>
            Done
          </button>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'drawer'}
        onClose={() => setDialog(null)}
        variant="drawer"
        title="Menu"
      >
        <ul role="list" style={{ display: 'grid', gap: 'var(--sp-3)', padding: 0 }}>
          {['Home', 'Missions', 'History', 'Progress', 'Studio', 'Settings'].map((item, index) => (
            <li key={item}>
              <a className="text-link" href="#actions">
                {String(index + 1).padStart(2, '0')} {item}
              </a>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
