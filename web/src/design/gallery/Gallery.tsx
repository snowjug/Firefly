import { useState, type ReactNode } from 'react';
import { PRODUCT_IDS, PRODUCT_INFO } from '#shared/domain/vocab.ts';
import {
  Avatar,
  Badge,
  BackLink,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  CUSTOMER_STATES,
  Dialog,
  Disclosure,
  Divider,
  Field,
  Icon,
  ICON_NAMES,
  IconButton,
  LinkButton,
  MessageBar,
  ProductIcon,
  ProgressBar,
  ProgressShimmer,
  ScoreBar,
  ScoreRow,
  SearchBox,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  SplitView,
  StateBadge,
  StatusBadge,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TextArea,
  TextInput,
  TextLink,
  ToggleButton,
  useAnnouncer,
  type BadgeTone,
} from '../index.ts';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="gx-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 className="t-title3" id={`${id}-title`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  column,
}: {
  label: string;
  children: ReactNode;
  column?: boolean;
}) {
  return (
    <div className="gx-row">
      <p className="t-label gx-row__label">{label}</p>
      <div className={column ? 'gx-cell gx-cell--column' : 'gx-cell'}>{children}</div>
    </div>
  );
}

const APPEARANCES = ['primary', 'secondary', 'outline', 'subtle', 'danger'] as const;
const SIZES = ['small', 'medium', 'large'] as const;
const TONES: BadgeTone[] = ['neutral', 'info', 'success', 'warning', 'danger', 'ai'];

const SECTIONS = [
  ['icons', 'Icons'],
  ['products', 'Product marks'],
  ['buttons', 'Buttons'],
  ['choose', 'Choosing'],
  ['fields', 'Fields'],
  ['status', 'Status'],
  ['feedback', 'Feedback'],
  ['motion', 'Motion'],
  ['people', 'People and scores'],
  ['disclosure', 'Disclosure and split view'],
  ['surfaces', 'Surfaces and tabs'],
  ['dialogs', 'Dialogs'],
  ['announcer', 'Announcements'],
] as const;

const CALL_STATES = [
  { label: 'Ready', tone: 'neutral', live: false },
  { label: 'Listening', tone: 'info', live: true },
  { label: 'Transcribing', tone: 'info', live: false },
  { label: 'Customer speaking', tone: 'ai', live: true },
  { label: 'Paused', tone: 'warning', live: false },
  { label: 'Reconnecting', tone: 'warning', live: true },
] as const;

/** Things that move, with a way to replay each one. Under reduced motion every one stands still. */
function MotionDemo() {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  const state = CALL_STATES[step % CALL_STATES.length] ?? CALL_STATES[0];
  return (
    <>
      <Row label="Call status">
        <StatusBadge label={state.label} tone={state.tone} live={state.live} />
        <Button size="small" onClick={() => setStep((current) => current + 1)}>
          Next state
        </Button>
        <span className="t-meta">The word fades in place; nothing around it moves.</span>
      </Row>
      <Row label="All states">
        {CALL_STATES.map((each) => (
          <StatusBadge key={each.label} label={each.label} tone={each.tone} live={each.live} />
        ))}
      </Row>
      <Row label="Transcribing" column>
        <div className="gx-narrow l-stack l-gap-3">
          <ProgressShimmer label="Transcribing your reply" />
          <ProgressShimmer label="Small" size="small" width="60%" />
        </div>
      </Row>
      <Row label="Press and nudge">
        <Button appearance="primary" size="large" icon="arrow-right" iconPosition="end" nudge>
          Start call
        </Button>
        <Button appearance="secondary" icon="arrow-right" iconPosition="end" nudge>
          Explore scenarios
        </Button>
        <span className="t-meta">
          Press: 1 to 2 px down. Hover or focus: the arrow leans forward.
        </span>
      </Row>
      <Row label="Speaking">
        <Avatar name="Maya Okafor" size="lg" speaking voice="customer" label="Maya is speaking" />
        <Avatar name="Maya Okafor" size="lg" speaking label="You are speaking" />
      </Row>
      <Row label="Fill once" column>
        <div className="gx-narrow l-stack l-gap-3" key={round}>
          <ScoreBar score={4} animate />
          <ScoreBar score={2.5} animate />
          <Button size="small" onClick={() => setRound((current) => current + 1)}>
            Replay
          </Button>
        </div>
      </Row>
    </>
  );
}

const SCENARIOS = [
  {
    id: 'a',
    title: 'Nobody can sign in',
    product: 'entra-id',
    detail: 'High impact. First contact.',
  },
  {
    id: 'b',
    title: 'Meetings will not start',
    product: 'teams',
    detail: 'Medium impact. Follow-up.',
  },
  { id: 'c', title: 'Mailbox is full', product: 'outlook', detail: 'Low impact. Starter.' },
] as const;

function DisclosureDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const current = SCENARIOS.find((scenario) => scenario.id === selected) ?? null;
  return (
    <>
      <Row label="Rows" column>
        <div className="gx-narrow">
          <Disclosure summary="Known context">The customer first noticed it on Monday.</Disclosure>
          <Disclosure summary="Previous contact" meta="2 cases" icon="clock">
            Two earlier cases were closed without a fix.
          </Disclosure>
          <Disclosure summary="Environment" defaultOpen headingLevel={3}>
            A small team, a shared mailbox and conditional access.
          </Disclosure>
        </div>
      </Row>
      <Row label="Inline">
        <Disclosure summary="More about speech" appearance="inline">
          Where speech is processed depends on the set-up shown before the call.
        </Disclosure>
      </Row>
      <Row label="Score rows" column>
        <div className="gx-narrow">
          <ScoreRow label="Opening & Rapport" score={4} evidenceCount={2}>
            <p className="t-body">A clear greeting and a confirmed reason for the call.</p>
          </ScoreRow>
          <ScoreRow label="Scoping & Discovery" score={5} evidenceCount={3} defaultOpen>
            <p className="t-body">Open questions about timing, scope and recent changes.</p>
          </ScoreRow>
          <ScoreRow label="Empathy & De-escalation" score={3} evidenceCount={1}>
            <p className="t-body">Acknowledged the impact once, early in the call.</p>
          </ScoreRow>
          <ScoreRow label="Closing" score={null} />
        </div>
      </Row>
      <Row label="Split view" column>
        <SplitView
          listLabel="Scenarios"
          detailLabel="Scenario details"
          detailOpen={current !== null}
          onBack={() => setSelected(null)}
          backLabel="Back to scenarios"
          detailKey={current?.id}
          listSize="sm"
          list={
            <ul className="l-stack l-gap-2" role="list">
              {SCENARIOS.map((scenario) => (
                <li key={scenario.id}>
                  <Button
                    appearance="outline"
                    fullWidth
                    aria-pressed={selected === scenario.id}
                    onClick={() => setSelected(scenario.id)}
                  >
                    {scenario.title}
                  </Button>
                </li>
              ))}
            </ul>
          }
          detail={
            current ? (
              <Card appearance="outlined" padding="lg">
                <div className="l-stack l-gap-2">
                  <p className="t-label">
                    <ProductIcon product={current.product} size={16} />{' '}
                    {PRODUCT_INFO[current.product].name}
                  </p>
                  <h3 className="t-subtitle1">{current.title}</h3>
                  <p className="t-body t-muted">{current.detail}</p>
                </div>
              </Card>
            ) : (
              <p className="t-body t-muted">Choose a scenario.</p>
            )
          }
        />
      </Row>
    </>
  );
}

function ProductMarks() {
  return (
    <div className="gx-icons">
      {PRODUCT_IDS.map((product) => (
        <div className="gx-icon" key={product}>
          <div className="gx-icon__sizes">
            <ProductIcon product={product} size={16} />
            <ProductIcon product={product} size={24} />
            <ProductIcon product={product} size={32} />
          </div>
          <span className="gx-icon__name">{product}</span>
        </div>
      ))}
    </div>
  );
}

type DialogKind = 'sm' | 'md' | 'lg' | 'sheet' | 'fullscreen' | 'confirm' | null;

function DialogsDemo() {
  const [kind, setKind] = useState<DialogKind>(null);
  const [mountOpen, setMountOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setKind(null);
    setBusy(false);
  };
  const body = (
    <div className="l-stack l-gap-3">
      <p>
        Calls and transcripts that Firefly has already saved are not affected. This dialog is a
        native element: the page behind it is inert and does not scroll.
      </p>
      <Field label="Name for this practice call" hint="Only you can see it.">
        <TextInput placeholder="For example, Billing query" />
      </Field>
    </div>
  );
  const actions = (
    <>
      <Button onClick={close}>Cancel</Button>
      <Button appearance="primary" onClick={close}>
        Save
      </Button>
    </>
  );
  return (
    <>
      <Row label="Open">
        <Button onClick={() => setKind('sm')}>Small</Button>
        <Button onClick={() => setKind('md')}>Medium</Button>
        <Button onClick={() => setKind('lg')}>Large</Button>
        <Button onClick={() => setKind('sheet')}>Bottom sheet on narrow</Button>
        <Button onClick={() => setKind('fullscreen')}>Full screen on narrow</Button>
        <Button appearance="danger" onClick={() => setKind('confirm')}>
          Must be answered
        </Button>
        <Button onClick={() => setMountOpen(true)}>Mount already open</Button>
      </Row>
      <Dialog
        open={kind === 'sm'}
        onClose={close}
        size="sm"
        title="Rename this call"
        description="Pick something you will recognise later."
        actions={actions}
      >
        {body}
      </Dialog>
      <Dialog
        open={kind === 'md'}
        onClose={close}
        title="Practice call settings"
        description="Changes apply to your next call."
        actions={actions}
      >
        {body}
      </Dialog>
      <Dialog
        open={kind === 'lg'}
        onClose={close}
        size="lg"
        title="Call transcript"
        actions={actions}
      >
        {body}
        {Array.from({ length: 8 }, (_, index) => (
          <p key={index} className="t-reading">
            Customer: I can open the workspace on my phone, but not on the laptop I use at the desk,
            and I am out of ideas. Engineer: Thank you for explaining that. Which sign-in message do
            you see on the laptop?
          </p>
        ))}
      </Dialog>
      <Dialog
        open={kind === 'sheet'}
        onClose={close}
        mobile="sheet"
        title="Filter scenarios"
        actions={actions}
      >
        {body}
      </Dialog>
      <Dialog
        open={kind === 'fullscreen'}
        onClose={close}
        mobile="fullscreen"
        title="Configure the call"
        actions={actions}
      >
        {body}
      </Dialog>
      <Dialog
        open={kind === 'confirm'}
        onClose={close}
        size="sm"
        dismissible={false}
        title="End the call and review it?"
        description="Your transcript so far is saved. You cannot return to this call afterwards."
        actions={
          <>
            <Button data-autofocus onClick={close}>
              Keep talking
            </Button>
            <Button
              appearance="danger"
              loading={busy}
              loadingLabel="Ending the call"
              onClick={() => {
                setBusy(true);
                window.setTimeout(close, 1500);
              }}
            >
              End and review
            </Button>
          </>
        }
      />
      <Dialog
        open={mountOpen}
        onClose={() => setMountOpen(false)}
        size="sm"
        title="Open on first render"
        description="This dialog was open the moment it mounted, and it still works."
        actions={<Button onClick={() => setMountOpen(false)}>Close</Button>}
      />
    </>
  );
}

function AnnouncerDemo() {
  const announce = useAnnouncer();
  const [count, setCount] = useState(0);
  return (
    <Row label="Polite region">
      <Button
        onClick={() => {
          setCount((n) => n + 1);
          announce(`Message ${count + 1} sent.`);
        }}
      >
        Announce a sentence
      </Button>
      <Button
        onClick={() => {
          announce('The customer is speaking.');
          announce('The customer is speaking.');
          announce('The customer finished. Your turn.');
        }}
      >
        Queue two, send one twice
      </Button>
      <span className="t-meta">Read by a screen reader; nothing is drawn.</span>
    </Row>
  );
}

export function Gallery() {
  const [pressed, setPressed] = useState(false);
  const [mood, setMood] = useState<string | null>('frustrated');
  const [mode, setMode] = useState<string | null>('immersive');
  const [query, setQuery] = useState('billing');
  const [tab, setTab] = useState('summary');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tags, setTags] = useState(['Billing', 'Sign-in', 'Slow performance']);

  return (
    <main className="gx-page" id="main" tabIndex={-1}>
      <a className="skip-link" href="#icons">
        Skip to the specimens
      </a>
      <div className="gx-intro">
        <h1 className="t-title1">Firefly design gallery</h1>
        <p className="t-body t-muted measure">
          Every primitive in every state. Development only: this page is served by the Vite dev
          server and is not part of the build.
        </p>
      </div>
      <nav aria-label="Gallery sections">
        <ul className="gx-toc" role="list">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="icons" title="Icons">
        <div className="gx-icons">
          {ICON_NAMES.map((name) => (
            <div className="gx-icon" key={name}>
              <div className="gx-icon__sizes">
                <Icon name={name} size={16} />
                <Icon name={name} size={24} />
                <Icon name={name} size={32} />
              </div>
              <span className="gx-icon__name">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="products" title="Product marks">
        <ProductMarks />
      </Section>

      <Section id="buttons" title="Buttons">
        {APPEARANCES.map((appearance) => (
          <Row key={appearance} label={appearance}>
            {SIZES.map((size) => (
              <Button key={size} appearance={appearance} size={size}>
                {size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large'}
              </Button>
            ))}
            <Button appearance={appearance} icon="phone">
              With icon
            </Button>
            <Button appearance={appearance} icon="arrow-right" iconPosition="end">
              Continue
            </Button>
            <Button appearance={appearance} disabled>
              Disabled
            </Button>
            <Button appearance={appearance} disabledFocusable>
              Disabled, focusable
            </Button>
          </Row>
        ))}
        <Row label="Loading">
          <Button
            appearance="primary"
            icon="phone"
            loading={loading}
            loadingLabel="Starting the call"
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 2500);
            }}
          >
            Start call
          </Button>
          <Button
            appearance="primary"
            loading={loading}
            loadingLabel="Saving"
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 2500);
            }}
          >
            Save changes
          </Button>
          <Button loading>Always loading</Button>
          <Button appearance="primary" loading icon="send">
            Send
          </Button>
        </Row>
        <Row label="Long label">
          <div className="gx-narrow">
            <Button appearance="primary" fullWidth>
              Start the practice call with the scenario you chose
            </Button>
          </div>
        </Row>
        <Row label="Icon buttons">
          {(['subtle', 'secondary', 'outline', 'primary', 'danger'] as const).map((appearance) => (
            <IconButton
              key={appearance}
              appearance={appearance}
              icon="microphone"
              label="Microphone"
            />
          ))}
          <IconButton icon="more" label="More actions" size="small" />
          <IconButton icon="x" label="Close" size="large" />
          <IconButton icon="send" label="Send" appearance="primary" loading />
          <IconButton icon="trash" label="Delete" disabled />
        </Row>
        <Row label="Toggle buttons">
          <ToggleButton pressed={pressed} onPressedChange={setPressed} icon="caption">
            Captions
          </ToggleButton>
          <ToggleButton pressed={!pressed} onPressedChange={(next) => setPressed(!next)}>
            Hands-free
          </ToggleButton>
          <ToggleButton
            pressed={pressed}
            onPressedChange={setPressed}
            icon="microphone-off"
            label="Mute microphone"
            appearance="subtle"
          />
        </Row>
        <Row label="Links">
          <LinkButton to="/scenarios" appearance="primary">
            Start call
          </LinkButton>
          <LinkButton to="/about" appearance="outline" icon="document">
            Read more
          </LinkButton>
          <LinkButton href="https://github.com/snowjug/Firefly" external appearance="secondary">
            Source on GitHub
          </LinkButton>
          <TextLink to="/responsible-ai">Responsible AI</TextLink>
          <TextLink href="https://github.com/snowjug/Firefly" external>
            An external link
          </TextLink>
        </Row>
      </Section>

      <Section id="choose" title="Choosing">
        <Row label="Segments" column>
          <SegmentedControl
            legend="Business impact"
            value={mood}
            onChange={setMood}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'frustrated', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
          <SegmentedControl
            legend="Starting temperature"
            hint="How the customer feels when the call begins."
            value={mood}
            onChange={setMood}
            options={[
              { value: 'calm', label: 'Calm', icon: 'state-calm' },
              { value: 'concerned', label: 'Anxious', icon: 'state-concerned' },
              { value: 'frustrated', label: 'Frustrated', icon: 'state-frustrated' },
              { value: 'angry', label: 'Angry or escalating', icon: 'state-angry' },
            ]}
          />
          <SegmentedControl
            legend="Communication style"
            value="non-native"
            onChange={() => undefined}
            options={[
              { value: 'talkative', label: 'Talkative' },
              { value: 'terse', label: 'Terse' },
              { value: 'demanding', label: 'Demanding' },
              { value: 'vague', label: 'Vague' },
              { value: 'non-native', label: 'Non-native English speaker' },
            ]}
          />
          <SegmentedControl
            legend="Small, full width"
            size="small"
            fullWidth
            value="b"
            onChange={() => undefined}
            options={[
              { value: 'a', label: 'One' },
              { value: 'b', label: 'Two' },
              { value: 'c', label: 'Three', disabled: true },
            ]}
          />
        </Row>
        <Row label="Cards" column>
          <SegmentedControl
            legend="Practice mode"
            value={mode}
            onChange={setMode}
            options={[
              {
                value: 'immersive',
                label: 'Assessment practice',
                description: 'No tips or cues on screen. Feels like a real call.',
              },
              {
                value: 'guided',
                label: 'Guided practice',
                description: 'Shows short tips and light cues during the call.',
              },
            ]}
          />
        </Row>
        <Row label="Checkbox" column>
          <Checkbox
            label="Hands-free: the microphone reopens after each reply"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <Checkbox
            label="Share the transcript with my coach"
            description="Only the words in the transcript. Audio is never kept."
            checked={false}
            onChange={() => undefined}
          />
          <Checkbox label="Some chosen" indeterminate checked={false} onChange={() => undefined} />
          <Checkbox label="Disabled" disabled checked onChange={() => undefined} />
        </Row>
        <Row label="Switch" column>
          <Switch
            label="Show captions"
            checked={on}
            onChange={(event) => setOn(event.target.checked)}
          />
          <Switch
            label="Read replies aloud"
            description="Uses your browser's speech service."
            labelPosition="before"
            checked={!on}
            onChange={(event) => setOn(!event.target.checked)}
          />
          <Switch label="Disabled" disabled checked={false} onChange={() => undefined} />
        </Row>
      </Section>

      <Section id="fields" title="Fields">
        <Row label="Text input" column>
          <div className="gx-narrow l-stack l-gap-4">
            <Field label="Scenario name" hint="Shown in your recent calls.">
              <TextInput placeholder="For example, Missing orders" />
            </Field>
            <Field label="Required field" required>
              <TextInput defaultValue="Maya Okonkwo" />
            </Field>
            <Field label="With a problem" error="Enter a name of at least three characters.">
              <TextInput defaultValue="Ma" />
            </Field>
            <Field label="Disabled" disabled>
              <TextInput defaultValue="Cannot be changed" />
            </Field>
            <Field label="Read only">
              <TextInput readOnly defaultValue="Read only value" />
            </Field>
            <Field label="With icon">
              <TextInput leadingIcon="person" placeholder="Customer name" />
            </Field>
            <Field label="Small">
              <TextInput size="small" placeholder="Compact field" />
            </Field>
          </div>
        </Row>
        <Row label="Text area" column>
          <div className="gx-narrow l-stack l-gap-4">
            <Field label="Your reply" hint="Up to 1,000 characters.">
              <TextArea placeholder="Type what you would say" />
            </Field>
            <Field label="With a problem" error="Write a reply before you send it.">
              <TextArea rows={2} />
            </Field>
          </div>
        </Row>
        <Row label="Search" column>
          <div className="gx-narrow l-stack l-gap-4">
            <Field label="Search scenarios" hideLabel>
              <SearchBox value={query} onChange={setQuery} placeholder="Search scenarios" />
            </Field>
            <SearchBox
              label="Empty search"
              value=""
              onChange={() => undefined}
              placeholder="Search"
            />
          </div>
        </Row>
        <Row label="Select" column>
          <div className="gx-narrow l-stack l-gap-4">
            <Field label="Speech language">
              <Select defaultValue="en-GB">
                <option value="en-GB">English (United Kingdom)</option>
                <option value="en-US">English (United States)</option>
                <option value="en-IE">English (Ireland)</option>
                <option value="en-AU">English (Australia)</option>
                <option value="en-IN">English (India)</option>
              </Select>
            </Field>
            <Field label="With a problem" error="Choose a language.">
              <Select defaultValue="">
                <option value="">Choose</option>
                <option value="en-GB">English (United Kingdom)</option>
              </Select>
            </Field>
            <Field label="Disabled" disabled>
              <Select defaultValue="en-GB">
                <option value="en-GB">English (United Kingdom)</option>
              </Select>
            </Field>
          </div>
        </Row>
      </Section>

      <Section id="status" title="Status">
        {(['tint', 'outline'] as const).map((appearance) => (
          <Row key={appearance} label={`Badges, ${appearance}`}>
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone} appearance={appearance}>
                {tone === 'ai' ? 'AI-generated' : tone[0]?.toUpperCase() + tone.slice(1)}
              </Badge>
            ))}
          </Row>
        ))}
        <Row label="Customer state">
          {CUSTOMER_STATES.map((state) => (
            <StateBadge key={state} state={state} />
          ))}
        </Row>
        <Row label="Customer state, small">
          {CUSTOMER_STATES.map((state) => (
            <StateBadge key={state} state={state} size="small" />
          ))}
        </Row>
        <Row label="Provider">
          <Badge tone="neutral" icon="info">
            Demo mode
          </Badge>
          <Badge tone="ai">Live: Azure OpenAI</Badge>
          <Badge tone="warning">Demo mode, check configuration</Badge>
        </Row>
        <Row label="Tags">
          {tags.map((tag) => (
            <Tag
              key={tag}
              onRemove={() => setTags((all) => all.filter((t) => t !== tag))}
              removeLabel={`Remove ${tag}`}
            >
              {tag}
            </Tag>
          ))}
          <Tag icon="clock">12 min</Tag>
          <Tag size="small">Small tag</Tag>
          <Button
            size="small"
            appearance="subtle"
            onClick={() => setTags(['Billing', 'Sign-in', 'Slow performance'])}
          >
            Reset
          </Button>
        </Row>
      </Section>

      <Section id="feedback" title="Feedback">
        <Row label="Message bars" column>
          <MessageBar intent="info" title="Speech goes to your browser's speech service">
            Edge and Chrome send what you say to their own service. Firefly does not keep audio.
          </MessageBar>
          <MessageBar intent="success" title="Call saved">
            Your transcript is ready to review.
          </MessageBar>
          <MessageBar
            intent="warning"
            title="You are offline"
            actions={<Button size="small">Try again</Button>}
          >
            Firefly keeps what you have done so far and will reconnect when your connection returns.
          </MessageBar>
          {dismissed ? null : (
            <MessageBar
              intent="error"
              title="The customer did not reply"
              actions={
                <>
                  <Button size="small" appearance="primary">
                    Try again
                  </Button>
                  <Button size="small">Go to scenarios</Button>
                </>
              }
              onDismiss={() => setDismissed(true)}
            >
              Your message is saved. Send it again to continue the call.
            </MessageBar>
          )}
          <MessageBar intent="info">A short note with no title.</MessageBar>
        </Row>
        <Row label="Spinner">
          <Spinner size="tiny" label="Loading" />
          <Spinner size="small" label="Loading" />
          <Spinner size="medium" label="Loading scenarios" showLabel />
          <Spinner size="large" label="Loading Firefly" showLabel labelPosition="after" />
        </Row>
        <Row label="Progress" column>
          <div className="gx-narrow l-stack l-gap-4">
            <ProgressBar label="Evaluating the call" showLabel showValue value={60} />
            <ProgressBar
              label="Step"
              showLabel
              showValue
              value={3}
              max={5}
              valueText="Step 3 of 5"
            />
            <ProgressBar label="Preparing the report" showLabel />
            <ProgressBar label="Small" size="small" value={30} />
            <ProgressBar label="Large success" size="large" tone="success" value={80} />
          </div>
        </Row>
        <Row label="Skeleton" column>
          <div className="gx-narrow l-stack l-gap-3" aria-busy="true">
            <div className="l-cluster">
              <Skeleton variant="circle" />
              <div className="u-grow">
                <Skeleton width="60%" />
              </div>
            </div>
            <Skeleton lines={3} />
            <Skeleton variant="rect" height="5rem" />
          </div>
        </Row>
      </Section>

      <Section id="motion" title="Motion">
        <MotionDemo />
      </Section>

      <Section id="people" title="People and scores">
        <Row label="Avatars">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <Avatar key={size} name="Maya Okonkwo" size={size} />
          ))}
          <Avatar name="Declan" tone="brand" />
          <Avatar name="Firefly coach" tone="ai" />
          <Avatar name="Maya Okonkwo" size="lg" speaking label="Maya Okonkwo is speaking" />
        </Row>
        <Row label="Scores" column>
          <ScoreBar score={1} />
          <ScoreBar score={2} />
          <ScoreBar score={3} />
          <ScoreBar score={4} />
          <ScoreBar score={5} />
          <ScoreBar score={3.5} />
          <ScoreBar score={null} />
          <ScoreBar score={4} size="small" />
          <ScoreBar score={4} size="large" />
          <ScoreBar score={2} showText={false} label="Developing" />
        </Row>
      </Section>

      <Section id="disclosure" title="Disclosure and split view">
        <DisclosureDemo />
      </Section>

      <Section id="surfaces" title="Surfaces and tabs">
        <Row label="Surfaces">
          <Card appearance="flat">Flat</Card>
          <Card appearance="outlined">Outlined</Card>
          <Card appearance="elevated">Elevated</Card>
          <Card appearance="outlined" padding="lg">
            Large padding
          </Card>
        </Row>
        <Row label="Dividers" column>
          <Divider />
          <Divider label="or" />
          <div className="l-cluster">
            <span>One</span>
            <Divider orientation="vertical" />
            <span>Two</span>
            <Divider orientation="vertical" />
            <span>Three</span>
          </div>
        </Row>
        <Row label="Navigation" column>
          <Breadcrumb
            items={[{ label: 'Scenarios', to: '/scenarios' }, { label: 'Missing orders' }]}
          />
          <BackLink to="/scenarios">Back to scenarios</BackLink>
        </Row>
        <Row label="Tabs" column>
          <Tabs value={tab} onValueChange={setTab}>
            <TabList label="Report sections">
              <Tab value="summary" icon="document">
                Summary
              </Tab>
              <Tab value="skills">Skills</Tab>
              <Tab value="transcript" icon="chat">
                Transcript review
              </Tab>
              <Tab value="off" disabled>
                Disabled
              </Tab>
            </TabList>
            <TabPanel value="summary">
              <p>The summary panel. Arrow keys move between tabs; Home and End jump to the ends.</p>
            </TabPanel>
            <TabPanel value="skills">
              <p>The skills panel.</p>
            </TabPanel>
            <TabPanel value="transcript">
              <p>The transcript panel.</p>
            </TabPanel>
          </Tabs>
        </Row>
        <Row label="Stacked tabs" column>
          <Tabs defaultValue="teams">
            <TabList label="Products">
              <Tab value="teams">Teams</Tab>
              <Tab value="outlook">Outlook</Tab>
              <Tab value="entra">Entra ID</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="teams" stacked>
                <p>
                  Panels share one cell and crossfade, so the group is as tall as the tallest panel
                  and choosing a tab never moves what is below it. This one is short.
                </p>
              </TabPanel>
              <TabPanel value="outlook" stacked>
                <p>
                  Outlook. This one is a good deal longer than the others, on purpose: it sets the
                  height of the whole group, so the content under the tabs stays where it is when
                  you switch between them, whichever tab is showing, and whatever the width of the
                  window is.
                </p>
              </TabPanel>
              <TabPanel value="entra" stacked>
                <p>Entra ID. Also short.</p>
              </TabPanel>
            </TabPanels>
          </Tabs>
          <p className="t-meta">This line does not move.</p>
        </Row>
      </Section>

      <Section id="dialogs" title="Dialogs">
        <DialogsDemo />
      </Section>

      <Section id="announcer" title="Announcements">
        <AnnouncerDemo />
      </Section>
    </main>
  );
}
