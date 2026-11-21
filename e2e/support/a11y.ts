import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { GOOD_CALL } from './api.ts';

// Shared helpers for the accessibility and responsive specs (a11y.spec.ts, keyboard.spec.ts,
// responsive.spec.ts). Nothing here hard-codes a port or a path: every address is relative to the
// base URL the Playwright config provides.

// ---- axe -------------------------------------------------------------------------------------

/** The rule sets that decide the release gate. Best-practice rules are reported separately. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
export type AxeViolation = AxeResults['violations'][number];

export interface Scan {
  /** Violations of a WCAG 2.0, 2.1 or 2.2 A or AA rule. */
  wcag: AxeViolation[];
  /** Violations of best-practice rules that are not WCAG success criteria. */
  bestPractice: AxeViolation[];
}

/** Waits for every finite CSS animation and transition to end, so colours are measured at rest. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const running = document.getAnimations().filter((animation) => {
      const end = animation.effect?.getComputedTiming().endTime;
      return typeof end === 'number' && Number.isFinite(end);
    });
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  });
}

export async function scan(
  page: Page,
  options: { include?: string; exclude?: string[] } = {},
): Promise<Scan> {
  await settle(page);
  let builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS, 'best-practice']);
  if (options.include) builder = builder.include(options.include);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  const wcag = violations.filter((violation) =>
    violation.tags.some((tag) => WCAG_TAGS.includes(tag)),
  );
  return { wcag, bestPractice: violations.filter((violation) => !wcag.includes(violation)) };
}

/** One readable line per violation, for failure messages and the attached summary. */
export function describeViolations(violations: AxeViolation[]): string[] {
  return violations.map((violation) => {
    const nodes = violation.nodes
      .slice(0, 3)
      .map((node) => `${node.target.join(' ')} :: ${node.html.slice(0, 120)}`)
      .join(' | ');
    return `${violation.id} (${violation.impact ?? 'n/a'}, ${violation.nodes.length}): ${violation.help}. ${nodes}`;
  });
}

/**
 * Runs axe on the page as it is now. Any WCAG violation fails; so does a serious or critical
 * best-practice violation. Lesser best-practice findings are attached to the test instead.
 */
export async function expectAccessible(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options: { include?: string; exclude?: string[] } = {},
): Promise<Scan> {
  const result = await scan(page, options);
  const serious = result.bestPractice.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
  const notes = describeViolations(
    result.bestPractice.filter((violation) => !serious.includes(violation)),
  );
  // The report shows how many pages and states were scanned, and what best-practice rules found.
  const scans = testInfo.annotations.find((annotation) => annotation.type === 'axe scans');
  if (scans) scans.description = String(Number(scans.description) + 1);
  else testInfo.annotations.push({ type: 'axe scans', description: '1' });
  if (notes.length > 0) {
    testInfo.annotations.push({
      type: 'axe best practice',
      description: `${label}: ${notes.join(' | ')}`,
    });
  }
  expect(describeViolations(result.wcag), `${label}: WCAG violations`).toEqual([]);
  expect(describeViolations(serious), `${label}: serious best-practice violations`).toEqual([]);
  return result;
}

// ---- the page's structure --------------------------------------------------------------------

export interface Landmark {
  role: 'banner' | 'main' | 'contentinfo' | 'navigation' | 'region' | 'complementary' | 'form';
  name: string | null;
}

/** The landmarks a screen reader lists, computed with the HTML-AAM rules for header and footer. */
export async function landmarks(page: Page): Promise<Landmark[]> {
  return page.evaluate(() => {
    const SCOPING =
      'article, aside, main, nav, section, [role="article"], [role="complementary"], [role="main"], [role="navigation"], [role="region"]';
    const visible = (element: Element) =>
      !element.closest('[aria-hidden="true"], [inert]') &&
      element.checkVisibility({ visibilityProperty: true });
    const nameOf = (element: Element) => {
      const label = element.getAttribute('aria-label');
      if (label) return label.trim();
      const by = element.getAttribute('aria-labelledby');
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      return null;
    };
    const roles = [
      'banner',
      'main',
      'contentinfo',
      'navigation',
      'region',
      'complementary',
      'form',
    ];
    const found: { role: string; name: string | null }[] = [];
    for (const element of document.querySelectorAll(
      'header, footer, main, nav, aside, section, form, [role]',
    )) {
      if (!visible(element)) continue;
      const tag = element.tagName.toLowerCase();
      const name = nameOf(element);
      let role: string | null = element.getAttribute('role');
      if (!role) {
        if (tag === 'header') role = element.parentElement?.closest(SCOPING) ? null : 'banner';
        else if (tag === 'footer')
          role = element.parentElement?.closest(SCOPING) ? null : 'contentinfo';
        else if (tag === 'main') role = 'main';
        else if (tag === 'nav') role = 'navigation';
        else if (tag === 'aside') role = 'complementary';
        else if (tag === 'section') role = name ? 'region' : null;
        else if (tag === 'form') role = name ? 'form' : null;
      }
      if (role && roles.includes(role)) found.push({ role, name });
    }
    return found as Landmark[];
  });
}

export interface HeadingEntry {
  level: number;
  text: string;
}

/** Every heading a screen reader would find (visually hidden ones included, hidden ones not). */
export async function headings(page: Page): Promise<HeadingEntry[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')]
      .filter(
        (element) =>
          !element.closest('[aria-hidden="true"], [inert]') &&
          element.checkVisibility({ visibilityProperty: true }),
      )
      .map((element) => ({
        level: element.getAttribute('aria-level')
          ? Number(element.getAttribute('aria-level'))
          : Number(element.tagName.slice(1)) || 2,
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
  );
}

/** Problems with a heading outline: not exactly one h1, or a level skipped on the way down. */
export function outlineProblems(outline: HeadingEntry[]): string[] {
  const problems: string[] = [];
  const h1 = outline.filter((entry) => entry.level === 1);
  if (h1.length !== 1) problems.push(`expected one h1, found ${h1.length}`);
  let previous = 0;
  for (const entry of outline) {
    if (previous > 0 && entry.level > previous + 1) {
      problems.push(`h${previous} is followed by h${entry.level} ("${entry.text}")`);
    }
    previous = entry.level;
  }
  return problems;
}

/**
 * Problems with the page's landmark structure: exactly one main, every navigation named, no two
 * landmarks with the same role and name, and the expected banner and contentinfo counts.
 */
export async function structureProblems(
  page: Page,
  expected: { banner: number; contentinfo: number },
): Promise<string[]> {
  const found = await landmarks(page);
  const problems = outlineProblems(await headings(page));
  const count = (role: Landmark['role']) =>
    found.filter((landmark) => landmark.role === role).length;
  if (count('main') !== 1) problems.push(`expected one main, found ${count('main')}`);
  if (count('banner') !== expected.banner) {
    problems.push(`expected ${expected.banner} banner, found ${count('banner')}`);
  }
  if (count('contentinfo') !== expected.contentinfo) {
    problems.push(`expected ${expected.contentinfo} contentinfo, found ${count('contentinfo')}`);
  }
  const seen = new Set<string>();
  for (const landmark of found) {
    if (landmark.role === 'navigation' && !landmark.name) problems.push('a navigation has no name');
    const key = `${landmark.role}:${landmark.name ?? ''}`;
    if (landmark.role !== 'main' && landmark.name && seen.has(key)) {
      problems.push(`two landmarks are ${landmark.role} "${landmark.name}"`);
    }
    seen.add(key);
  }
  return problems;
}

// ---- layout ----------------------------------------------------------------------------------

export interface OverflowReport {
  scrollWidth: number;
  innerWidth: number;
  /** Visible elements that stick out of the viewport and are not inside a scroll container. */
  offenders: string[];
}

/** Horizontal overflow: the page's scroll width, and the elements that cause it. */
export async function overflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    // Only a container the person can scroll makes content that sticks out reachable; one that
    // hides its overflow cuts it off.
    const scrollable = (element: Element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent === document.documentElement || parent === document.body) continue;
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) return true;
      }
      return false;
    };
    const offenders: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      if (offenders.length >= 8) break;
      if (element.closest('.visually-hidden, .skip-link, dialog:not([open]), [hidden], svg *')) {
        continue;
      }
      const style = getComputedStyle(element);
      if (style.position === 'fixed' || !element.checkVisibility({ visibilityProperty: true })) {
        continue;
      }
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if ((box.right > width + 1 || box.left < -1) && !scrollable(element)) {
        const classes =
          typeof element.className === 'string' && element.className
            ? `.${element.className.split(/\s+/).join('.')}`
            : '';
        offenders.push(
          `${element.tagName.toLowerCase()}${classes} [${Math.round(box.left)}..${Math.round(box.right)}] "${(element.textContent ?? '').trim().slice(0, 30)}"`,
        );
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: width,
      offenders,
    };
  });
}

export interface TargetSize {
  name: string;
  width: number;
  height: number;
}

/**
 * Visible controls, headings and labels whose text is cut off by their own box (a box that hides its
 * overflow and has more inside than it shows). A label that is cut is a label nobody can read.
 */
export async function clippedText(page: Page, root = 'main'): Promise<string[]> {
  return page.evaluate((selector) => {
    const found: string[] = [];
    const scope = document.querySelector(selector);
    if (!scope) return found;
    for (const element of scope.querySelectorAll(
      'button, a, h1, h2, h3, h4, label, summary, [role="tab"], [role="radio"], legend',
    )) {
      if (found.length >= 8) break;
      if (element.closest('.visually-hidden, .skip-link, [hidden], svg')) continue;
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      const style = getComputedStyle(element);
      const hides = /hidden|clip/.test(style.overflowX) || /hidden|clip/.test(style.overflowY);
      const box = element as HTMLElement;
      // A heading kept for screen readers is cut down to a pixel on purpose.
      if (box.clientWidth <= 2 || box.clientHeight <= 2) continue;
      if (
        hides &&
        (box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1)
      ) {
        found.push(
          `${element.tagName.toLowerCase()} "${(element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}" (${box.scrollWidth}x${box.scrollHeight} in ${box.clientWidth}x${box.clientHeight})`,
        );
      }
    }
    return found;
  }, root);
}

/** The rendered size of the first visible match, so a test can assert a minimum target size. */
export async function targetSize(page: Page, selector: string): Promise<TargetSize | null> {
  return page.evaluate((query) => {
    for (const element of document.querySelectorAll(query)) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width > 0 && box.height > 0 && style.visibility !== 'hidden') {
        return {
          name: (element.getAttribute('aria-label') ?? element.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 40),
          width: Math.round(box.width * 10) / 10,
          height: Math.round(box.height * 10) / 10,
        };
      }
    }
    return null;
  }, selector);
}

// ---- focus -----------------------------------------------------------------------------------

export interface FocusStop {
  tag: string;
  role: string | null;
  name: string;
  /** The element, or the box a visually hidden input draws its ring on, shows a focus indicator. */
  ring: boolean;
  /** Contrast of the indicator against the colour next to it (at least 3 is required). */
  ringContrast: number;
  inView: boolean;
}

/** What has keyboard focus now, and whether it can be seen. Null when nothing (the body) has it. */
export async function focusStop(page: Page): Promise<FocusStop | null> {
  return page.evaluate(async () => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return null;
    const channel = (value: string): [number, number, number, number] | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = (match[1] ?? '')
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = (v ?? 0) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    const contrast = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
    };
    const backgroundOf = (element: Element): number[] => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const colour = channel(getComputedStyle(node).backgroundColor);
        if (colour && colour[3] >= 0.99) return colour.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const box = active.getBoundingClientRect();
    const hidden = box.width <= 2 || box.height <= 2 || getComputedStyle(active).opacity === '0';
    const candidates: Element[] = [active];
    if (hidden) {
      for (const extra of [
        active.nextElementSibling,
        active.parentElement,
        active.closest('label'),
        active.closest('[class*="item"]'),
        active.closest('[class*="row"]'),
      ]) {
        if (extra) candidates.push(extra);
      }
    }
    let ring = false;
    let ringContrast = 0;
    for (const candidate of candidates) {
      const style = getComputedStyle(candidate);
      const width = parseFloat(style.outlineWidth);
      if (style.outlineStyle !== 'none' && width >= 1) {
        ring = true;
        const colour = channel(style.outlineColor);
        const against = backgroundOf(candidate.parentElement ?? candidate);
        // System colours (forced colours) resolve to rgb too; an unreadable colour counts as fine.
        ringContrast = colour ? contrast(colour.slice(0, 3), against) : 21;
        break;
      }
      if (style.boxShadow !== 'none') {
        ring = true;
        ringContrast = 21;
        break;
      }
    }
    // A control drawn inside an SVG (a point on a chart) cannot take an outline in every browser, so
    // its ring is a stroke-only shape inside it that ignores the pointer. It counts when it is drawn.
    if (!ring && active instanceof SVGElement) {
      // The ring fades in; read it once it has.
      await Promise.all(
        active
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
      for (const shape of active.querySelectorAll('circle, rect, ellipse, path, polygon')) {
        const style = getComputedStyle(shape);
        const stroke = channel(style.stroke);
        if (
          stroke &&
          style.fill === 'none' &&
          style.pointerEvents === 'none' &&
          parseFloat(style.strokeWidth) >= 1.5 &&
          parseFloat(style.opacity) >= 0.9
        ) {
          ring = true;
          ringContrast = contrast(stroke.slice(0, 3), backgroundOf(active));
          break;
        }
      }
    }
    const rect = (
      candidates.find((candidate) => candidate.getBoundingClientRect().width > 2) ?? active
    ).getBoundingClientRect();
    const nameOf = (element: Element): string => {
      const aria = element.getAttribute('aria-label');
      if (aria) return aria;
      const by = element.getAttribute('aria-labelledby');
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      const field = element as HTMLInputElement;
      const label = field.labels?.[0]?.textContent?.trim();
      const legend = element.closest('fieldset')?.querySelector('legend')?.textContent?.trim();
      if (label) return legend && field.type === 'radio' ? `${legend}: ${label}` : label;
      const text = element.textContent?.trim();
      return text || field.value || element.getAttribute('title') || '';
    };
    return {
      tag: active.tagName.toLowerCase(),
      role: active.getAttribute('role'),
      name: nameOf(active).replace(/\s+/g, ' ').trim().slice(0, 80),
      ring,
      ringContrast: Math.round(ringContrast * 10) / 10,
      inView:
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth,
    };
  });
}

/** Presses Tab (or Shift+Tab) `count` times, returning where focus landed each time. */
export async function tabStops(
  page: Page,
  count: number,
  backwards = false,
): Promise<(FocusStop | null)[]> {
  const stops: (FocusStop | null)[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    stops.push(await focusStop(page));
  }
  return stops;
}

/**
 * Presses Tab (or Shift+Tab) until the focused element's name matches, and says how many presses it
 * took. Every stop on the way must show a focus indicator, with at least 3:1 contrast, in view.
 * Throws if the name is not reached within `limit` presses.
 */
export async function tabTo(
  page: Page,
  name: RegExp | string,
  limit = 80,
  backwards = false,
): Promise<number> {
  for (let presses = 1; presses <= limit; presses += 1) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    const stop = await focusStop(page);
    if (!stop) continue;
    const where = `"${stop.name}" (Tab stop ${presses} towards ${String(name)})`;
    expect(stop.ring, `a focus indicator on ${where}`).toBe(true);
    expect(stop.ringContrast, `focus indicator contrast on ${where}`).toBeGreaterThanOrEqual(3);
    expect(stop.inView, `${where} is in view`).toBe(true);
    if (typeof name === 'string' ? stop.name === name : name.test(stop.name)) return presses;
  }
  throw new Error(`Tab did not reach "${String(name)}" within ${limit} presses`);
}

// ---- a controllable microphone ---------------------------------------------------------------

declare global {
  interface Window {
    __fireflyMic?: {
      level: number;
      deny: string | null;
      gain: GainNode | null;
      requests: number;
      startedAt: number | null;
    };
  }
}

/**
 * Replaces `getUserMedia` with a stream the test controls: silence until `speak(page, true)`, then a
 * steady tone the voice-activity detector hears as speech. It makes the spoken states (Listening,
 * Hearing you) hold still long enough to be examined, and it can refuse permission. It does not
 * replace the browser's own microphone prompt, which no automation can drive.
 */
export async function installFakeMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      level: 0,
      deny: null as string | null,
      gain: null as GainNode | null,
      requests: 0,
      startedAt: null as number | null,
    };
    window.__fireflyMic = state;
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = async () => {
      state.requests += 1;
      if (state.deny) throw new DOMException('The microphone was refused.', state.deny);
      const context = new AudioContext();
      void context.resume();
      const destination = context.createMediaStreamDestination();
      const tone = context.createOscillator();
      tone.frequency.value = 220;
      const gain = context.createGain();
      gain.gain.value = state.level;
      tone.connect(gain).connect(destination);
      tone.start();
      state.gain = gain;
      return destination.stream;
    };
  });
}

/** Starts or stops the tone the fake microphone is producing. Stopping waits out a short utterance. */
export async function speak(page: Page, on: boolean): Promise<void> {
  await page.evaluate(
    async (level) => {
      const mic = window.__fireflyMic;
      if (!mic) return;
      // The detector drops anything shorter than 400 ms, so a tone is held for 700 ms at least.
      if (level === 0 && mic.startedAt !== null) {
        const remaining = 700 - (performance.now() - mic.startedAt);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      mic.startedAt = level > 0 ? performance.now() : null;
      mic.level = level;
      if (mic.gain) mic.gain.gain.value = level;
    },
    on ? 0.35 : 0,
  );
}

/**
 * Waits, in the page, until the tone has been on for `ms`. An utterance shorter than 400 ms is a click
 * and not speech, so a journey that ends a turn with "Done speaking" has to let it last first.
 */
export async function holdTone(page: Page, ms = 800): Promise<void> {
  await page.waitForFunction((held) => {
    const started = window.__fireflyMic?.startedAt;
    return typeof started === 'number' && performance.now() - started >= held;
  }, ms);
}

/** Makes the next requests for the microphone fail the way a browser's refusal does. */
export async function refuseMicrophone(page: Page, name = 'NotAllowedError'): Promise<void> {
  await page.evaluate((error) => {
    if (window.__fireflyMic) window.__fireflyMic.deny = error;
  }, name);
}

/** A mono 16 kHz WAV of quiet noise, for a customer voice that lasts as long as a test needs. */
export function quietWav(seconds: number): Buffer {
  const rate = 16000;
  const samples = Math.round(seconds * rate);
  const data = Buffer.alloc(samples * 2);
  let seed = 1;
  for (let i = 0; i < samples; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data.writeInt16LE(Math.round(((seed / 0xffffffff) * 2 - 1) * 900), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/**
 * Makes the customer's voice last `seconds`, however short the real (scripted) one is, so the
 * "customer is speaking" state can be examined. The reply is still the server's own.
 */
export async function lengthenCustomerVoice(page: Page, seconds: number): Promise<void> {
  const wav = quietWav(seconds);
  await page.route('**/api/sessions/*/turns/*/speech*', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    delete headers['content-length'];
    await route.fulfill({
      status: response.status(),
      headers,
      contentType: 'audio/wav',
      body: wav,
    });
  });
}

// ---- sessions made through the API -----------------------------------------------------------

/** A starter, first-contact scenario: a calm, terse customer (Marcus Bell, an Outlook shared mailbox). */
export const SCENARIO_ID = 'outlook-shared-mailbox-missing';
/** A challenge, escalated scenario: an angry, expert customer (Gareth Owens, a SharePoint site). */
export const HARD_SCENARIO_ID = 'sharepoint-site-access-escalated';

/**
 * Things a new trainee might say, which move the demo customer and uncover what it holds back. They
 * are written for SCENARIO_ID (see GOOD_CALL in api.ts); said to another scenario's customer they
 * still make a transcript and a report, with fewer facts found.
 */
export const TRAINEE_LINES: readonly string[] = GOOD_CALL;

export async function createSession(
  request: APIRequestContext,
  scenarioId = SCENARIO_ID,
): Promise<string> {
  const response = await request.post('/api/sessions', { data: { scenarioId } });
  expect(response.ok(), 'POST /api/sessions').toBe(true);
  const body = (await response.json()) as { session: { id: string } };
  return body.session.id;
}

export async function sendLines(
  request: APIRequestContext,
  id: string,
  lines: readonly string[],
): Promise<void> {
  for (const [index, text] of lines.entries()) {
    const response = await request.post(`/api/sessions/${id}/messages`, {
      data: { text, clientMessageId: `a11y-${id}-${index}` },
    });
    expect(response.ok(), `POST message ${index}`).toBe(true);
  }
}

/** Ends a call and waits until the server has written the report (or failed to). */
export async function endSession(request: APIRequestContext, id: string): Promise<string> {
  await request.post(`/api/sessions/${id}/end`);
  let status = 'completing';
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await request.get(`/api/sessions/${id}`);
    const body = (await response.json()) as { session?: { status: string } };
    status = body.session?.status ?? 'unknown';
    if (status === 'completed' || status === 'evaluation_failed') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return status;
}

/** A finished call with a report, made through the API in whichever profile `request` belongs to. */
export async function finishedCall(
  request: APIRequestContext,
  scenarioId = SCENARIO_ID,
): Promise<string> {
  const id = await createSession(request, scenarioId);
  await sendLines(request, id, TRAINEE_LINES);
  const status = await endSession(request, id);
  expect(status, 'the evaluation finishes').toBe('completed');
  return id;
}

// ---- failures on demand (the server's test hooks) --------------------------------------------

type FailureTarget = 'customer' | 'classifier' | 'evaluator' | 'transcribe' | 'synthesize';
const FAILURE_TARGETS: FailureTarget[] = [
  'customer',
  'classifier',
  'evaluator',
  'transcribe',
  'synthesize',
];

/** The next `count` calls to that part of the server fail. The hooks are server-wide. */
export async function failNext(
  request: APIRequestContext,
  target: FailureTarget,
  count = 1,
): Promise<void> {
  const response = await request.post('/api/test/fail-next', { data: { target, count } });
  expect(response.ok(), `POST /api/test/fail-next ${target}`).toBe(true);
}

/** Leaves no failure queued, so one test never breaks the next. */
export async function clearFailures(request: APIRequestContext): Promise<void> {
  for (const target of FAILURE_TARGETS) await failNext(request, target, 0);
}

/** Records every sentence the polite announcer is given, from the moment the page loads. */
export async function watchAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    const record = () => {
      // Each region is followed on its own: a dialog brings a region of its own for as long as it is open.
      const last = new WeakMap<Element, string>();
      new MutationObserver(() => {
        for (const region of document.querySelectorAll('[role="status"][aria-live="polite"]')) {
          const text = (region.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text !== (last.get(region) ?? '')) said.push(text);
          last.set(region, text);
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    };
    if (document.documentElement) record();
    else document.addEventListener('DOMContentLoaded', record);
  });
  return async () =>
    (await page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice())).filter(
      Boolean,
    );
}

// ---- a spoken call, one stage at a time ------------------------------------------------------

/**
 * The call's status line has reached this state. The line carries it as `data-status`: `customer-speaking`,
 * `mic-ready`, `listening`, `speech-detected` ("Hearing you"), `processing-speech`,
 * `generating-reply` ("Customer is replying"), `muted`, `paused`, `text-fallback` ("Typing") ...
 */
export async function expectStatus(page: Page, status: string, timeout = 20_000): Promise<void> {
  await expect(page.locator(`.cw-status[data-status="${status}"]`)).toBeVisible({ timeout });
}

/** Delays, in milliseconds, that hold the call at "Processing speech" and "Customer is replying". */
export interface Delays {
  transcribe: number;
  reply: number;
}

/**
 * Opens a spoken call with the controllable microphone and a long customer voice, and starts it: the
 * page is left on "Customer speaking" (the greeting). The returned `delays` can be raised to hold a
 * later stage still.
 */
export async function startSpokenCall(
  page: Page,
  options: { scenarioId?: string; voiceSeconds?: number } = {},
): Promise<{ id: string; delays: Delays }> {
  await installFakeMicrophone(page);
  await lengthenCustomerVoice(page, options.voiceSeconds ?? 30);
  const delays: Delays = { transcribe: 0, reply: 0 };
  await page.route('**/api/speech/transcribe*', async (route) => {
    if (delays.transcribe) await new Promise((resolve) => setTimeout(resolve, delays.transcribe));
    await route.continue();
  });
  await page.route('**/api/sessions/*/messages', async (route) => {
    if (delays.reply && route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, delays.reply));
    }
    await route.continue();
  });
  const id = await createSession(page.request, options.scenarioId ?? HARD_SCENARIO_ID);
  await page.goto(`/calls/${id}?input=voice`);
  await page.getByRole('button', { name: 'Start voice call' }).click();
  await expectStatus(page, 'customer-speaking');
  return { id, delays };
}

// ---- one profile, one finished call, for every test in a worker ------------------------------

export interface World {
  cookies: Awaited<ReturnType<BrowserContext['cookies']>>;
  /** A finished call with a full coaching report. */
  reportId: string;
}

let world: Promise<World> | null = null;

/**
 * `test` with a `world` fixture: the first test to ask for it makes a finished call through the
 * API, and every later test gets the same anonymous profile (its cookie), so each fresh browser
 * context sees that call. Anything a test changes on the server it makes for itself.
 */
export const test = base.extend<{ world: World }>({
  world: async ({ page }, use) => {
    world ??= (async () => {
      const reportId = await finishedCall(page.request);
      return { cookies: await page.context().cookies(), reportId };
    })().catch((error: unknown) => {
      world = null;
      throw error;
    });
    const shared = await world;
    await page.context().addCookies(shared.cookies);
    await use(shared);
  },
});

export { expect };
