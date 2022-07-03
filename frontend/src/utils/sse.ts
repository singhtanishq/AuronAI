import type { StreamEvent } from '../types';

/**
 * Incremental SSE parser for the chat streaming protocol.
 *
 * Transport chunks are NOT semantic boundaries: a network read may contain
 * several events, partial events, or both. This parser buffers raw text and
 * yields only complete `data:` frames.
 */
export class SseParser {
  private buffer = '';

  /** Feed a raw network chunk; returns every complete event it completed. */
  push(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];

    // Frames are separated by a blank line; handle \r\n as well.
    let separatorIndex: number;
    while ((separatorIndex = this.buffer.search(/\r?\n\r?\n/)) !== -1) {
      const rawFrame = this.buffer.slice(0, separatorIndex);
      this.buffer = this.buffer.slice(separatorIndex).replace(/^\r?\n\r?\n/, '');

      for (const event of parseFrame(rawFrame)) {
        events.push(event);
      }
    }
    return events;
  }

  /** Flush any buffered partial frame (call when the stream ends). */
  flush(): StreamEvent[] {
    const remainder = this.buffer;
    this.buffer = '';
    if (!remainder.trim()) return [];
    return parseFrame(remainder);
  }
}

function parseFrame(rawFrame: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  // A frame may contain multiple `data:` lines (joined with \n per SSE spec).
  const dataLines = rawFrame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'));

  if (dataLines.length === 0) return events;

  const payload = dataLines.map((line) => line.slice(5).replace(/^ /, '')).join('\n');
  if (!payload.trim()) return events;

  try {
    const parsed = JSON.parse(payload) as StreamEvent;
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      events.push(parsed);
    }
  } catch {
    // Malformed frame: skip rather than corrupt the message stream.
  }
  return events;
}
