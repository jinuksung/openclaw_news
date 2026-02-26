import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const TELEGRAM_TOKEN_PATTERN = /\b\d{8,}:[A-Za-z0-9_-]{20,}\b/g;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{20,}\b/g;

function maskSensitive(text: string): string {
  return text
    .replace(TELEGRAM_TOKEN_PATTERN, '[REDACTED]')
    .replace(OPENAI_KEY_PATTERN, '[REDACTED]');
}

function serializeMeta(meta: unknown): string {
  if (meta === undefined) {
    return '';
  }

  try {
    return ` ${maskSensitive(JSON.stringify(meta))}`;
  } catch {
    return ' [meta-unserializable]';
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return maskSensitive(error.message);
  }

  return maskSensitive(String(error));
}

export function createLogger(logPath: string = resolve(process.cwd(), 'logs/news-alert.log')): Logger {
  const ensureLogDir = mkdir(dirname(logPath), { recursive: true });

  const write = async (line: string): Promise<void> => {
    await ensureLogDir;
    await appendFile(logPath, `${line}\n`, 'utf8');
  };

  const log = (level: LogLevel, message: string, meta?: unknown): void => {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} [${level}] ${maskSensitive(message)}${serializeMeta(meta)}`;

    if (level === 'ERROR') {
      console.error(line);
    } else {
      console.log(line);
    }

    void write(line).catch(() => {
      // Logging should never crash the app.
    });
  };

  return {
    info: (message, meta) => {
      log('INFO', message, meta);
    },
    warn: (message, meta) => {
      log('WARN', message, meta);
    },
    error: (message, meta) => {
      log('ERROR', message, meta);
    },
    debug: (message, meta) => {
      log('DEBUG', message, meta);
    }
  };
}
