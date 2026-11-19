import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { markVoiceSession } from '../../lib/voice-sessions.ts';
import { useVoiceCall, type VoiceCall } from '../../lib/voice/index.ts';
import type { ChatTurn } from './useCall.ts';

export interface CallVoice {
  voice: VoiceCall;
  /** A voice call has been started (it may still be connecting, or waiting for a retry). */
  calling: boolean;
  handsFree: boolean;
  setHandsFree(on: boolean): void;
  /** Starts the voice call or hangs up. Call it from a click or tap. */
  toggleCall(): void;
  /** Hangs up if a call is on. */
  hangUp(): void;
}

interface Options {
  sessionId: string;
  /** Voice has been turned on in the profile. Nothing happens while it is off. */
  allowed: boolean;
  /** The customer's name keeps one voice for the whole call. */
  customer: string;
  mood: TemperatureBandId;
  /** A message is being sent or the customer is replying. */
  busy: boolean;
  turns: ChatTurn[];
  playTones: boolean;
  /** The call can take another message of this length. */
  canSend(text: string): boolean;
  /** Hands-free: a sentence goes straight out as the person's message. */
  send(text: string): Promise<unknown>;
  /** Push to talk: a sentence goes into the message box to be read and corrected first. */
  putInBox(text: string): void;
}

/**
 * Joins the voice engine to the conversation. The engine hears and speaks; this decides what the
 * words do: they are sent (hands-free) or offered in the box (push to talk), the customer's replies
 * are read out, and the call is marked as having used voice so the report can say so.
 */
export function useCallVoice(options: Options): CallVoice {
  const { sessionId, allowed, customer, mood, busy, turns, playTones, canSend, send, putInBox } =
    options;
  const [calling, setCalling] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const marked = useRef(false);
  const turnsRef = useRef(turns);
  // Customer messages already on screen when the call opened, then each one as it arrives.
  const seen = useRef(new Set(turns.filter((t) => t.role === 'customer').map((t) => t.key)));
  const offered = useRef(new Set<string>());

  useEffect(() => {
    turnsRef.current = turns;
  });

  const active = allowed && calling;
  const voice = useVoiceCall({
    enabled: active,
    speakCustomer: true,
    handsFree,
    voiceSeed: customer,
    mood,
    busy,
    playTones,
    onUtterance(text) {
      if (!marked.current) {
        marked.current = true;
        markVoiceSession(sessionId);
      }
      if (handsFree && canSend(text)) return send(text).then(() => undefined);
      putInBox(text);
      return undefined;
    },
  });
  const { speakCustomerReply } = voice;

  // Each new customer reply is read out once, if a voice call is on.
  useEffect(() => {
    for (const turn of turns) {
      if (turn.role !== 'customer' || seen.current.has(turn.key)) continue;
      seen.current.add(turn.key);
      if (!active) continue;
      offered.current.add(turn.key);
      speakCustomerReply(turn.key, turn.text);
    }
  }, [turns, active, speakCustomerReply]);

  // Turning the preference off, in another tab for example, ends the call.
  const [wasAllowed, setWasAllowed] = useState(allowed);
  if (wasAllowed !== allowed) {
    setWasAllowed(allowed);
    if (!allowed) setCalling(false);
  }

  const toggleCall = useCallback(() => {
    if (calling) {
      voice.stop();
      setCalling(false);
      return;
    }
    setCalling(true);
    // A customer who spoke last is waiting for an answer: say it out loud once the line is open.
    void Promise.resolve(voice.start()).then(() => {
      const list = turnsRef.current;
      const last = list[list.length - 1];
      if (last?.role === 'customer' && !offered.current.has(last.key)) {
        offered.current.add(last.key);
        speakCustomerReply(last.key, last.text);
      }
    });
  }, [calling, voice, speakCustomerReply]);

  const hangUp = useCallback(() => {
    voice.stop();
    setCalling(false);
  }, [voice]);

  return { voice, calling: active, handsFree, setHandsFree, toggleCall, hangUp };
}
