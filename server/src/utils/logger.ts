/**
 * Simple logging utility
 * Does NOT log sensitive data (tokens, passwords, PII)
 *
 * Output format is chosen once at startup and never changes:
 *   - TTY + non-production  →  colored, indented human-readable output
 *   - non-TTY or production →  JSON (one object per line, log-collector friendly)
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ANSI helpers (used only in pretty mode)
// ---------------------------------------------------------------------------

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
} as const;

const LEVEL_STYLE: Record<LogLevel, { badge: string; color: string }> = {
  debug: { badge: 'DBG', color: C.gray   },
  info:  { badge: 'INF', color: C.cyan   },
  warn:  { badge: 'WRN', color: C.yellow },
  error: { badge: 'ERR', color: C.red    },
};

// "HH:MM:SS" (8) + " " (1) + "LVL" (3) + "  " (2) = 14
const CONTEXT_INDENT = ' '.repeat(14);

// ---------------------------------------------------------------------------

class Logger {
  private readonly pretty: boolean;

  constructor() {
    this.pretty =
      process.stdout.isTTY === true &&
      (process.env.NODE_ENV || 'development') !== 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    if (level === 'debug' && (process.env.NODE_ENV || 'development') === 'production') {
      return false;
    }
    return true;
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sensitiveKeys = [
      'accessToken',
      'refreshToken',
      'token',
      'password',
      'secret',
      'authorization',
      'cookie',
    ];

    const sanitized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitiveKey =>
        lowerKey.includes(sensitiveKey)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as LogContext);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // -------------------------------------------------------------------------
  // Pretty formatter (TTY / development)
  // -------------------------------------------------------------------------

  private colorValue(value: unknown): string {
    if (value === null || value === undefined) return `${C.dim}${String(value)}${C.reset}`;
    if (typeof value === 'number')  return `${C.yellow}${value}${C.reset}`;
    if (typeof value === 'boolean') return value ? `${C.green}true${C.reset}` : `${C.red}false${C.reset}`;
    if (typeof value === 'string')  return value;
    return `${C.dim}${JSON.stringify(value)}${C.reset}`;
  }

  private formatPretty(level: LogLevel, message: string, context?: LogContext): string {
    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0'))
      .join(':');

    const { badge, color } = LEVEL_STYLE[level];
    const msgColor = level === 'error' ? C.red : level === 'warn' ? C.yellow : '';

    const lines: string[] = [
      `${C.gray}${time}${C.reset} ${color}${C.bold}${badge}${C.reset}  ${msgColor}${message}${C.reset}`,
    ];

    if (!context || Object.keys(context).length === 0) {
      return lines.join('\n');
    }

    // Pull error out — it is rendered last with special stack handling.
    const { error: errorEntry, ...rest } = context;
    const entries = Object.entries(rest);

    if (entries.length > 0) {
      const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
      for (const [key, value] of entries) {
        lines.push(
          `${CONTEXT_INDENT}${C.cyan}${C.dim}${key.padEnd(maxKeyLen)}${C.reset}  ${this.colorValue(value)}`
        );
      }
    }

    if (errorEntry !== undefined) {
      const hasStack =
        typeof errorEntry === 'object' &&
        errorEntry !== null &&
        'stack' in errorEntry &&
        typeof (errorEntry as { stack?: unknown }).stack === 'string';

      if (hasStack) {
        // Stack already starts with "ErrorName: message\n    at …"
        for (const line of (errorEntry as { stack: string }).stack.split('\n')) {
          lines.push(`${CONTEXT_INDENT}${C.red}${C.dim}${line}${C.reset}`);
        }
      } else {
        const keyLen = entries.length > 0
          ? Math.max(...entries.map(([k]) => k.length), 5)
          : 5;
        lines.push(
          `${CONTEXT_INDENT}${C.red}${'error'.padEnd(keyLen)}${C.reset}  ${this.colorValue(errorEntry)}`
        );
      }
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // JSON formatter (non-TTY / production)
  // -------------------------------------------------------------------------

  private formatJson(level: LogLevel, message: string, context?: LogContext): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
    });
  }

  // -------------------------------------------------------------------------
  // Core
  // -------------------------------------------------------------------------

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitized = context ? this.sanitizeContext(context) : undefined;
    const output = this.pretty
      ? this.formatPretty(level, message, sanitized)
      : this.formatJson(level, message, sanitized);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorContext.error = error;
    }

    this.log('error', message, errorContext);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();
