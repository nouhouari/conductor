import pino from 'pino';

export function createLogger(name: string) {
  const isDev = process.env.NODE_ENV !== 'production';
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined
  });
}
