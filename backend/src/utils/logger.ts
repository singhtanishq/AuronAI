export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

class Logger {
  private level: LogLevel = 'info';
  private isDevelopment = process.env.NODE_ENV !== 'production';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  private formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      meta,
    };
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const prefix = this.isDevelopment ? `\x1b[${this.getColor(entry.level)}m[${entry.level.toUpperCase()}]\x1b[0m` : `[${entry.level.toUpperCase()}]`;
    const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';

    if (entry.level === 'error') {
      console.error(`${prefix} ${entry.timestamp} ${entry.message}${metaStr}`);
    } else if (entry.level === 'warn') {
      console.warn(`${prefix} ${entry.timestamp} ${entry.message}${metaStr}`);
    } else {
      console.log(`${prefix} ${entry.timestamp} ${entry.message}${metaStr}`);
    }
  }

  private getColor(level: LogLevel): number {
    switch (level) {
      case 'debug': return 36; // cyan
      case 'info': return 32; // green
      case 'warn': return 33; // yellow
      case 'error': return 31; // red
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('debug', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('error', message, meta));
  }
}

export const logger = new Logger();

if (process.env.NODE_ENV === 'development') {
  logger.setLevel('debug');
}