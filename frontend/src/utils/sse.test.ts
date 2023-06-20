import { describe, it, expect } from 'vitest';
import { SseParser } from './sse';
import type { StreamEvent } from '../types';

function eventsOf(chunks: string[]): StreamEvent[] {
  const parser = new SseParser();
  const collected: StreamEvent[] = [];
  for (const chunk of chunks) {
    collected.push(...parser.push(chunk));
  }
  collected.push(...parser.flush());
  return collected;
}

describe('SseParser', () => {
  it('parses a single complete frame', () => {
    const events = eventsOf(['data: {"type":"delta","assistantMessageId":"a1","content":"Hi"}\n\n']);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'delta', assistantMessageId: 'a1', content: 'Hi' });
  });

  it('buffers partial frames across transport chunks (regression: split events)', () => {
    const events = eventsOf([
      'data: {"type":"delta","assistantMessageId":"a1","con',
      'tent":"The ans',
      'wer"}\n\ndata: {"type":"del',
    ]);
    // The second frame is incomplete and must NOT be emitted yet.
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'delta', assistantMessageId: 'a1', content: 'The answer' });
  });

  it('completes a buffered frame on flush', () => {
    const parser = new SseParser();
    parser.push('data: {"type":"done","assistantMessageId":"a1"}');
    expect(parser.push('')).toHaveLength(0);
    const flushed = parser.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0].type).toBe('done');
  });

  it('handles multiple events arriving in one network chunk', () => {
    const payload =
      'data: {"type":"start","conversationId":"c","userMessageId":"u","assistantMessageId":"a"}\n\n' +
      'data: {"type":"delta","assistantMessageId":"a","content":"one"}\n\n' +
      'data: {"type":"delta","assistantMessageId":"a","content":"two"}\n\n';
    const events = eventsOf([payload]);
    expect(events.map((e) => e.type)).toEqual(['start', 'delta', 'delta']);
  });

  it('handles CRLF line endings', () => {
    const events = eventsOf(['data: {"type":"delta","assistantMessageId":"a","content":"crlf"}\r\n\r\n']);
    expect(events).toHaveLength(1);
    expect((events[0] as { content: string }).content).toBe('crlf');
  });

  it('ignores keep-alive comments and malformed JSON without corrupting the stream', () => {
    const payload =
      ': keep-alive\n\n' +
      'data: {"type":"delta","assistantMessageId":"a","content":"ok"}\n\n' +
      'data: {broken json\n\n' +
      'data: {"type":"done","assistantMessageId":"a"}\n\n';
    const events = eventsOf([payload]);
    expect(events.map((e) => e.type)).toEqual(['delta', 'done']);
  });

  it('accumulates many transport chunks into ordered deltas (regression: many bubbles)', () => {
    // Simulate the upstream symptom: one network packet per token fragment.
    const words = ['The ', 'answer ', 'is ', 'straightforward. ', 'First, ', 'consider ', 'the ', 'reason.'];
    const chunks = words.map((word) => `data: ${JSON.stringify({ type: 'delta', assistantMessageId: 'a1', content: word })}\n\n`);
    const events = eventsOf(chunks);
    const text = events.map((e) => (e as { content: string }).content).join('');
    expect(text).toBe('The answer is straightforward. First, consider the reason.');
    // All deltas belong to the same message id — one assistant message.
    expect(events.every((e) => (e as { assistantMessageId: string }).assistantMessageId === 'a1')).toBe(true);
  });
});
