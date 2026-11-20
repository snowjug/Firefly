import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import {
  ChoiceRow,
  Disclosure,
  EmptyNotice,
  Field,
  Ledger,
  PageFrame,
  PageHead,
  Section,
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

// Gallery only (?view=page): the primitives composed the way a page agent would, on a quiet page.
// It is the check that they hold together as one language and not only one by one.

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'practice', label: 'Practice' },
  { id: 'device', label: 'This device', count: 3 },
];

export function PageDemo() {
  const [tab, setTab] = useState('practice');
  const [difficulty, setDifficulty] = useState('standard');
  const [style, setStyle] = useState('guided');
  const [hints, setHints] = useState(true);
  const [sound, setSound] = useState(false);
  const [voice, setVoice] = useState(false);
  const [name, setName] = useState('Sam Rivera');
  const [about, setAbout] = useState('');

  return (
    <PageFrame title="Settings" width="narrow">
      <PageHead
        eyebrow="06 / Settings"
        title="Profile and practice"
        lead="Everything here stays in this browser. Nothing is sent anywhere until you ask for it."
        actions={
          <Link className="text-link" to="/help">
            Responsible AI
          </Link>
        }
      />

      <TabRow label="Settings" tabs={TABS} active={tab} onChange={setTab} panelId="demo" />
      <div
        role="tabpanel"
        id={tabPanelDomId('demo', tab)}
        aria-labelledby={tabDomId('demo', tab)}
        className="gallery-panel"
      >
        <Section eyebrow="01" title="Who is practising">
          <div className="gallery-demo">
            <Field label="Display name" hint="Shown on this device only.">
              <TextInput
                value={name}
                maxLength={40}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field
              label="About you"
              hint="Optional. It helps you recognise your own profile, nothing else."
            >
              <TextArea
                serif
                rows={2}
                maxLength={160}
                value={about}
                onChange={(event) => setAbout(event.target.value)}
              />
            </Field>
            <div className="action-row">
              <button type="button" className="action">
                Save profile
                <Icon name="arrow-right" size={18} />
              </button>
              <button type="button" className="text-link">
                Cancel
              </button>
            </div>
          </div>
        </Section>

        <Section eyebrow="02" title="Practice defaults" aside={<Tag tone="sage">Saved</Tag>}>
          <div className="gallery-demo">
            <ChoiceRow
              legend="Starting difficulty"
              name="demo-difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'starter', label: 'Starter', hint: 'One thread, found early.' },
                {
                  value: 'standard',
                  label: 'Standard',
                  hint: 'Two threads, one of them held back until you ask.',
                },
                {
                  value: 'challenge',
                  label: 'Challenge',
                  hint: 'Three threads and a customer who changes the subject.',
                },
              ]}
            />
            <ChoiceRow
              legend="Practice style"
              name="demo-style"
              size="text"
              value={style}
              onChange={setStyle}
              options={[
                {
                  value: 'guided',
                  label: 'Guided',
                  hint: 'Cues about the customer appear as the call goes.',
                },
                { value: 'immersive', label: 'Immersive', hint: 'No cues, as in a real call.' },
              ]}
            />
            <div className="ff-rows">
              <Toggle
                checked={hints}
                onChange={setHints}
                label="Offer hints"
                hint="A hint only fills the reply box. You decide what is sent."
              />
              <Toggle checked={sound} onChange={setSound} label="Sound" />
              <Toggle
                checked={voice}
                onChange={setVoice}
                label="Voice (Beta)"
                hint="Uses your browser's speech service. Firefly never records or keeps audio."
              />
            </div>
          </div>
        </Section>

        <Section eyebrow="03" title="On this device">
          <div className="gallery-demo">
            <StatRow>
              <Stat label="Calls kept" value="0" />
              <Stat label="Points" value="0" note="Points are not a ranking" />
            </StatRow>
            <Ledger
              rows={[
                { label: 'Profile', value: 'Local to this browser' },
                { label: 'Storage', value: 'Browser storage, about 4 KB' },
                { label: 'Practice style', value: 'Guided' },
              ]}
            />
            <Disclosure summary="What is stored here?">
              <p className="type-read">
                Your name, your preferences and the calls you have practised. Clear them at any time
                from Data and privacy.
              </p>
            </Disclosure>
            <EmptyNotice
              title="No calls yet"
              action={
                <Link className="action action--quiet" to="/scenarios">
                  Choose a mission
                </Link>
              }
            >
              Your first call will appear here. Nothing on this page is a sample.
            </EmptyNotice>
          </div>
        </Section>
      </div>
    </PageFrame>
  );
}
