import { describe, expect, it } from 'vitest';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import {
  chooseVoice,
  cleanText,
  DEFAULT_VOICES,
  escapeXml,
  MAX_SPOKEN_CHARS,
  moodStylesAvailable,
  planSpeech,
  prepareSpokenText,
  prosodyFor,
  styleFor,
  voiceDirection,
  VOICE_STYLES,
  type Speaker,
} from './voices.ts';

const MOODS = TEMPERATURE_BANDS.map((b) => b.id);
const SPEAKERS: Speaker[] = ['female', 'male'];
const direction = (
  mood: TemperatureBandId,
  speaker: Speaker = 'female',
  language: SpeechLanguage = 'en-GB',
) => voiceDirection({ speaker, language, mood });

/** A small check that an SSML document is well formed: tags nest, attributes are quoted, text holds no stray markup. */
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  const token = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:.-]+="[^"<&]*")*)\s*(\/?)>|([^<]+)/gy;
  let at = 0;
  for (let m = token.exec(xml); m; m = token.exec(xml)) {
    at = token.lastIndex;
    const [, closing, name, , selfClosing, text] = m;
    if (text !== undefined) {
      if (text.includes('>') || /&(?!(?:amp|lt|gt|quot|apos);)/.test(text)) return false;
    } else if (closing) {
      if (stack.pop() !== name) return false;
    } else if (!selfClosing) {
      stack.push(name as string);
    }
  }
  return at === xml.length && stack.length === 0;
}

describe('the checker used below', () => {
  it('accepts well-formed documents and refuses broken ones', () => {
    expect(wellFormed('<a x="1"><b>t &amp; u</b></a>')).toBe(true);
    expect(wellFormed('<a><b></a></b>')).toBe(false);
    expect(wellFormed('<a>fish & chips</a>')).toBe(false);
    expect(wellFormed('<a x=1></a>')).toBe(false);
    expect(wellFormed('<a>text')).toBe(false);
  });
});

describe('the built-in voices', () => {
  it('are a female and a male standard neural voice for every language, spoken in that language', () => {
    expect(DEFAULT_VOICES).toEqual({
      'en-GB': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
      'en-US': { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' },
      'en-IE': { female: 'en-IE-EmilyNeural', male: 'en-IE-ConnorNeural' },
      'en-AU': { female: 'en-AU-NatashaNeural', male: 'en-AU-WilliamNeural' },
      'en-IN': { female: 'en-IN-NeerjaNeural', male: 'en-IN-PrabhatNeural' },
    });
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        const voice = DEFAULT_VOICES[language][speaker];
        expect(voice.startsWith(`${language}-`), voice).toBe(true);
        expect(voice.endsWith('Neural'), voice).toBe(true);
        // Every default has an entry in the verified table, even if it lists no styles.
        expect(VOICE_STYLES[voice], voice).toBeDefined();
      }
    }
  });

  it('can be replaced for a speaker, in every language', () => {
    expect(chooseVoice({ speaker: 'female', language: 'en-IE' })).toBe('en-IE-EmilyNeural');
    const overrides = { female: 'en-US-JennyNeural', male: null };
    expect(chooseVoice({ speaker: 'female', language: 'en-IE' }, overrides)).toBe(
      'en-US-JennyNeural',
    );
    expect(chooseVoice({ speaker: 'male', language: 'en-IE' }, overrides)).toBe(
      'en-IE-ConnorNeural',
    );
  });
});

describe('which voices have which styles', () => {
  it('gives Sonia and Ryan no angry or unfriendly style, because their documentation lists none', () => {
    expect(VOICE_STYLES['en-GB-SoniaNeural']).toEqual(['cheerful', 'sad']);
    expect(VOICE_STYLES['en-GB-RyanNeural']).toEqual(['chat', 'cheerful', 'sad', 'whispering']);
    for (const voice of ['en-GB-SoniaNeural', 'en-GB-RyanNeural']) {
      for (const mood of MOODS) {
        expect(styleFor(voice, direction(mood)), `${voice} ${mood}`).toBeNull();
      }
    }
  });

  it('lists no styles for the Irish, Australian and Indian male voices or the Irish and Australian female voices', () => {
    for (const voice of [
      'en-IE-EmilyNeural',
      'en-IE-ConnorNeural',
      'en-AU-NatashaNeural',
      'en-AU-WilliamNeural',
      'en-IN-PrabhatNeural',
    ]) {
      expect(VOICE_STYLES[voice], voice).toEqual([]);
    }
    // Neerja has three styles, none of them a frustrated or angry one.
    expect(VOICE_STYLES['en-IN-NeerjaNeural']).toEqual(['cheerful', 'empathetic', 'newscast']);
  });

  it('applies unfriendly for a frustrated customer and angry for an angry or escalating one, only on voices that list them', () => {
    for (const voice of ['en-US-AriaNeural', 'en-US-GuyNeural']) {
      expect(styleFor(voice, direction('frustrated'))?.style, voice).toBe('unfriendly');
      expect(styleFor(voice, direction('angry'))?.style, voice).toBe('angry');
      expect(styleFor(voice, direction('escalating'))?.style, voice).toBe('angry');
      expect(styleFor(voice, direction('calm')), voice).toBeNull();
      expect(styleFor(voice, direction('concerned')), voice).toBeNull();
    }
  });

  it('applies no style to a voice that is not in the verified table', () => {
    for (const mood of MOODS) {
      expect(styleFor('en-US-SomeNewVoiceNeural', direction(mood))).toBeNull();
      expect(styleFor('', direction(mood))).toBeNull();
    }
  });

  it('never asks for shouting, and never above a controlled degree', () => {
    for (const [voice, styles] of Object.entries(VOICE_STYLES)) {
      for (const mood of MOODS) {
        for (let intensity = 0; intensity <= 1.0001; intensity += 0.05) {
          const chosen = styleFor(voice, { mood, intensity });
          if (!chosen) continue;
          expect(styles, voice).toContain(chosen.style);
          expect(['unfriendly', 'angry']).toContain(chosen.style);
          expect(chosen.degree, `${voice} ${mood} ${intensity}`).toBeGreaterThanOrEqual(0.2);
          expect(chosen.degree, `${voice} ${mood} ${intensity}`).toBeLessThanOrEqual(0.9);
        }
      }
    }
  });

  it('grows the style degree with the mood', () => {
    const degrees = (['frustrated', 'angry', 'escalating'] as const).map(
      (mood) => styleFor('en-US-AriaNeural', direction(mood))?.degree,
    );
    expect(degrees).toEqual([0.55, 0.73, 0.9]);
  });
});

describe('mood to delivery', () => {
  it('speaks a calm customer at a measured pace and a hotter one more firmly', () => {
    expect(MOODS.map((mood) => [mood, direction(mood).pace, direction(mood).intensity])).toEqual([
      ['calm', 'measured', 0],
      ['concerned', 'brisk', 0.25],
      ['frustrated', 'firm', 0.5],
      ['angry', 'firm', 0.75],
      ['escalating', 'firm', 1],
    ]);
  });

  it('changes rate and pitch by small, increasing amounts when no style is applied', () => {
    expect(MOODS.map((mood) => prosodyFor(direction(mood), false))).toEqual([
      { rate: '-4%', pitch: null },
      { rate: '+6%', pitch: '+3%' },
      { rate: '+8%', pitch: '-2%' },
      { rate: '+11%', pitch: '-3%' },
      { rate: '+14%', pitch: '-4%' },
    ]);
  });

  it('leaves the pitch alone when a style carries the tone', () => {
    for (const mood of MOODS) expect(prosodyFor(direction(mood), true).pitch).toBeNull();
    expect(prosodyFor(direction('angry'), true).rate).toBe('+11%');
  });

  it('stays well inside the documented limits (rate 0.5 to 2 times, pitch 0.5 to 1.5 times)', () => {
    for (const mood of MOODS) {
      const { rate, pitch } = prosodyFor(direction(mood), false);
      expect(Math.abs(Number.parseInt(rate, 10))).toBeLessThanOrEqual(20);
      expect(Math.abs(Number.parseInt(pitch ?? '0', 10))).toBeLessThanOrEqual(10);
    }
  });

  it('copes with an intensity outside 0 to 1 or not a number', () => {
    expect(prosodyFor({ pace: 'firm', intensity: 5 }, false)).toEqual(
      prosodyFor({ pace: 'firm', intensity: 1 }, false),
    );
    expect(prosodyFor({ pace: 'firm', intensity: Number.NaN }, false).rate).toBe('+2%');
    expect(styleFor('en-US-AriaNeural', { mood: 'angry', intensity: -3 })?.degree).toBe(0.2);
  });
});

describe('whether moods can be voiced with styles', () => {
  it('is false with the built-in voices, because only the en-US voices list the styles', () => {
    expect(moodStylesAvailable()).toBe(false);
  });

  it('is true only when every language resolves to voices that list them', () => {
    expect(moodStylesAvailable({ female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' })).toBe(true);
    expect(moodStylesAvailable({ female: 'en-US-AriaNeural' })).toBe(false);
    expect(moodStylesAvailable({ female: 'en-US-AriaNeural', male: 'en-GB-RyanNeural' })).toBe(
      false,
    );
    expect(moodStylesAvailable({ female: 'en-US-NotListedNeural', male: 'en-US-GuyNeural' })).toBe(
      false,
    );
  });
});

describe('preparing the words to be spoken', () => {
  it('removes control characters and invisible formatting and tidies whitespace', () => {
    expect(cleanText('Hello\u0000 there\u0007,\n\tI\u200b am\u202e  here\u2028now \ufeffok')).toBe(
      'Hello there, I am here now ok',
    );
    expect(cleanText('a\u000bb\u000cc')).toBe('a b c');
    expect(cleanText('\u0085nel\u009f')).toBe('nel');
  });

  it('removes surrogates that are not part of a pair and keeps real emoji', () => {
    expect(cleanText('lone \ud800 high and \udc00 low')).toBe('lone high and low');
    expect(cleanText('fine \u{1f642} stays')).toBe('fine \u{1f642} stays');
  });

  it('leaves a short line as it is', () => {
    expect(prepareSpokenText('Hello. I need help.')).toEqual({
      text: 'Hello. I need help.',
      truncated: false,
    });
  });

  it('cuts a long line at the last whole sentence that fits', () => {
    const sentence = (n: number) =>
      `This is sentence number ${n} of the customer's long complaint.`;
    const long = Array.from({ length: 40 }, (_, i) => sentence(i + 1)).join(' ');
    expect(long.length).toBeGreaterThan(MAX_SPOKEN_CHARS);
    const result = prepareSpokenText(long);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(result.text.endsWith('complaint.')).toBe(true);
    expect(long.startsWith(result.text)).toBe(true);
    // Not a sentence short: the next one would not have fitted.
    const kept = result.text.split('. ').length;
    expect(`${result.text} ${sentence(kept + 1)}`.length).toBeGreaterThan(MAX_SPOKEN_CHARS);
  });

  it('cuts one very long sentence at a word instead', () => {
    const run = 'word '.repeat(400).trim();
    const result = prepareSpokenText(run, 100);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(100);
    expect(result.text.endsWith('word')).toBe(true);
  });

  it('cuts text that has no spaces at the limit', () => {
    expect(prepareSpokenText('x'.repeat(500), 100).text).toBe('x'.repeat(100));
  });
});

describe('escaping', () => {
  it('escapes every character that XML treats specially', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
    expect(escapeXml('plain words')).toBe('plain words');
  });
});

describe('planSpeech: the SSML request', () => {
  const line = `I've been waiting for two days & nobody has called <me> back.`;

  it('uses prosody alone for a frustrated customer on a voice with no styles, with the text escaped', () => {
    const plan = planSpeech(line, direction('frustrated'));
    expect(plan.voice).toBe('en-GB-SoniaNeural');
    expect(plan.style).toBe('none');
    expect(plan.ssml).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-GB">' +
        '<voice name="en-GB-SoniaNeural"><prosody rate="+8%" pitch="-2%">' +
        'I&apos;ve been waiting for two days &amp; nobody has called &lt;me&gt; back.' +
        '</prosody></voice></speak>',
    );
    expect(wellFormed(plan.ssml)).toBe(true);
  });

  it('adds the style, at a reduced degree and without a pitch change, when the voice lists it', () => {
    const plan = planSpeech(line, direction('angry', 'male', 'en-US'));
    expect(plan.voice).toBe('en-US-GuyNeural');
    expect(plan.style).toBe('angry');
    expect(plan.ssml).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">' +
        '<voice name="en-US-GuyNeural"><mstts:express-as style="angry" styledegree="0.73">' +
        '<prosody rate="+11%">I&apos;ve been waiting for two days &amp; nobody has called &lt;me&gt; back.</prosody>' +
        '</mstts:express-as></voice></speak>',
    );
    expect(wellFormed(plan.ssml)).toBe(true);
  });

  it('uses unfriendly for frustrated on the US female voice', () => {
    const plan = planSpeech('Hello.', direction('frustrated', 'female', 'en-US'));
    expect(plan.voice).toBe('en-US-AriaNeural');
    expect(plan.style).toBe('unfriendly');
    expect(plan.ssml).toContain('<mstts:express-as style="unfriendly" styledegree="0.55">');
  });

  it('plays a calm customer plainly, with no style for any voice', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        const plan = planSpeech('Hello.', direction('calm', speaker, language));
        expect(plan.style).toBe('none');
        expect(plan.ssml).not.toContain('express-as');
        expect(plan.ssml).toContain('<prosody rate="-4%">Hello.</prosody>');
      }
    }
  });

  it('never contains express-as or shouting unless the voice lists the style, for any voice, mood and language', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        for (const mood of MOODS) {
          const plan = planSpeech('Hello there.', direction(mood, speaker, language));
          expect(wellFormed(plan.ssml), `${language} ${speaker} ${mood}`).toBe(true);
          expect(plan.ssml).not.toContain('shouting');
          const styled = plan.ssml.includes('express-as');
          expect(styled, `${language} ${speaker} ${mood}`).toBe(plan.style !== 'none');
          if (styled) expect(VOICE_STYLES[plan.voice]).toContain(plan.style);
          if (styled) expect(language).toBe('en-US');
        }
      }
    }
  });

  it('declares the language of the voice it uses, even for a replacement voice', () => {
    expect(planSpeech('Hi.', direction('calm', 'male', 'en-AU')).ssml).toContain(
      'xml:lang="en-AU"',
    );
    const swapped = planSpeech('Hi.', direction('calm', 'female', 'en-GB'), {
      female: 'en-US-JennyNeural',
    });
    expect(swapped.voice).toBe('en-US-JennyNeural');
    expect(swapped.ssml).toContain('xml:lang="en-US"');
    expect(swapped.ssml).toContain('<voice name="en-US-JennyNeural">');
  });

  it('applies a style to a replacement voice only if the table lists it for that voice', () => {
    expect(planSpeech('Hi.', direction('angry'), { female: 'en-US-JennyNeural' }).style).toBe(
      'angry',
    );
    expect(planSpeech('Hi.', direction('angry'), { female: 'fr-FR-SomeoneNeural' }).style).toBe(
      'none',
    );
  });

  it('cannot be made to carry markup from the text', () => {
    const hostile =
      '</prosody></voice></speak><speak><voice name="evil"><audio src="http://x/y.wav"/>';
    const plan = planSpeech(hostile, direction('angry', 'female', 'en-US'));
    expect(wellFormed(plan.ssml)).toBe(true);
    expect(plan.ssml.match(/<voice /g)).toHaveLength(1);
    expect(plan.ssml.match(/<speak /g)).toHaveLength(1);
    expect(plan.ssml).not.toContain('<audio');
    expect(plan.ssml).toContain('&lt;/prosody&gt;');
  });

  it('strips control characters before building the document', () => {
    const plan = planSpeech('Hello\u0000\u0008 there\u001f.', direction('calm'));
    expect(plan.text).toBe('Hello there.');
    // eslint-disable-next-line no-control-regex
    expect(plan.ssml).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  });

  it('speaks a long line cut at a sentence and says so, leaving the stored text to the caller', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i + 1} is here.`).join(
      ' ',
    );
    const plan = planSpeech(long, direction('calm'));
    expect(plan.truncated).toBe(true);
    expect(plan.text.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(plan.text.endsWith('here.')).toBe(true);
    expect(planSpeech('Short.', direction('calm')).truncated).toBe(false);
  });

  it('keeps the request small whatever the text, even when every character needs escaping', () => {
    for (const worst of ['"', '&', '<', "'"]) {
      const plan = planSpeech(worst.repeat(5000), direction('angry', 'male', 'en-US'));
      expect(Buffer.byteLength(plan.ssml)).toBeLessThan(8192);
      expect(wellFormed(plan.ssml)).toBe(true);
    }
    // Wide characters take up to four bytes each in UTF-8.
    const wide = planSpeech('\u{1f642}'.repeat(5000), direction('calm'));
    expect(Buffer.byteLength(wide.ssml)).toBeLessThan(8192);
  });

  it('has nothing to speak for text that is only control characters', () => {
    expect(planSpeech('\u0000\u0001  \u200b', direction('calm')).text).toBe('');
  });
});
