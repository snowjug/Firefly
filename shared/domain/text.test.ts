import { describe, expect, it } from 'vitest';
import { looksSensitive, redactSensitive } from './text.ts';

// Redaction is pattern matching, so these pin what it is meant to catch and, as important, what it
// must leave alone: a customer's reply goes through it too. Every number here is made up.

describe('redactSensitive: phone numbers', () => {
  it.each([
    '+44 7700 900123',
    '07700 900123',
    '07700900123',
    '(555) 123-4567',
    '+1 (555) 123-4567',
    '+1-555-123-4567',
    '555.123.4567',
    '5551234567',
    '+49 30 12345678',
    '020 7946 0958',
    '+91 98765 43210',
    '+81 90-1234-5678',
  ])('removes %s, whatever the grouping', (number) => {
    const { text, redactions } = redactSensitive(`Call me on ${number} after lunch.`);
    expect(text).toBe('Call me on [phone removed] after lunch.');
    expect(redactions).toEqual(['phone']);
  });

  it.each([
    '2026-11-20',
    '20/11/2026 10:30',
    '2026-11-20T10:30:00Z',
    '10:30',
    '£1,200.50',
    'version 10.0.19045.3693',
    '192.168.100.200',
    'port 8080',
    'ext 4421 and ticket 20260112',
    'order 123456789',
    'sort code 12-34-56',
    'about 3 minutes since 2 pm',
    '1,500 users in 12 offices',
  ])('leaves %s alone: it is not a phone number', (text) => {
    expect(redactSensitive(text)).toEqual({ text, redactions: [] });
  });
});

describe('redactSensitive: the rest', () => {
  it('removes an email address and a long number, and keeps the space after the number', () => {
    const { text, redactions } = redactSensitive(
      'Mail jane.doe@example.com, card 4111 1111 1111 1111 and then call.',
    );
    expect(text).toBe('Mail [email removed], card [number removed] and then call.');
    expect(redactions.sort()).toEqual(['card', 'email']);
  });

  it('removes an identifier', () => {
    expect(redactSensitive('case 123e4567-e89b-12d3-a456-426614174000 is open').text).toBe(
      'case [id removed] is open',
    );
  });

  it('warns about what it would remove, and about nothing else', () => {
    expect(looksSensitive('my number is +44 7700 900123')).toEqual(['phone']);
    expect(looksSensitive('it started at 10:30 on 2026-11-20')).toEqual([]);
  });

  it('stays quick on a message of the largest allowed length', () => {
    const started = performance.now();
    redactSensitive('1 '.repeat(750));
    redactSensitive('1'.repeat(1500));
    redactSensitive('a.'.repeat(750));
    expect(performance.now() - started).toBeLessThan(200);
  });
});
