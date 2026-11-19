import { beforeEach, describe, expect, it } from 'vitest';
import { forgetVoiceSession, markVoiceSession, usedVoice } from './voice-sessions.ts';

beforeEach(() => localStorage.clear());

describe('voice sessions', () => {
  it('remembers which calls used voice', () => {
    expect(usedVoice('a')).toBe(false);
    markVoiceSession('a');
    markVoiceSession('a');
    expect(usedVoice('a')).toBe(true);
    expect(usedVoice('b')).toBe(false);
    expect(JSON.parse(localStorage.getItem('firefly.voiceSessions') ?? '[]')).toEqual(['a']);
  });

  it('forgets a call', () => {
    markVoiceSession('a');
    markVoiceSession('b');
    forgetVoiceSession('a');
    expect(usedVoice('a')).toBe(false);
    expect(usedVoice('b')).toBe(true);
  });

  it('keeps only the newest 100 calls', () => {
    for (let i = 0; i < 105; i++) markVoiceSession(`s${i}`);
    expect(usedVoice('s0')).toBe(false);
    expect(usedVoice('s4')).toBe(false);
    expect(usedVoice('s5')).toBe(true);
    expect(usedVoice('s104')).toBe(true);
  });

  it('copes with bad stored data and an empty id', () => {
    localStorage.setItem('firefly.voiceSessions', '{not json');
    expect(usedVoice('a')).toBe(false);
    localStorage.setItem('firefly.voiceSessions', JSON.stringify({ a: 1 }));
    expect(usedVoice('a')).toBe(false);
    localStorage.setItem('firefly.voiceSessions', JSON.stringify(['a', 7, null, '']));
    markVoiceSession('');
    expect(usedVoice('a')).toBe(true);
    markVoiceSession('b');
    expect(JSON.parse(localStorage.getItem('firefly.voiceSessions') ?? '[]')).toEqual(['a', 'b']);
  });
});
