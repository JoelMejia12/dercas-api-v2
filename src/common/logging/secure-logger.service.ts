import { Injectable, LoggerService } from '@nestjs/common';
import { LogLevel } from '../../config/environment';

type LogFields = Readonly<Record<string, string | number | boolean | undefined>>;
const sensitiveField = /password|token|secret|authorization|cookie|connection|credential|ip/i;

@Injectable()
export class SecureLogger implements LoggerService {
  private readonly levels: readonly LogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose'];
  private minimumLevel: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.minimumLevel = level;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', this.safeMessage(message), this.safeFields(optionalParams[0]));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', this.safeMessage(message), this.safeFields(optionalParams[0]));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', this.safeMessage(message), this.safeFields(optionalParams[0]));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', this.safeMessage(message), this.safeFields(optionalParams[0]));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', this.safeMessage(message), this.safeFields(optionalParams[0]));
  }

  private safeMessage(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.name || 'Error';
    return 'Application log event';
  }

  private safeFields(value: unknown): LogFields | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const safe: Record<string, string | number | boolean | undefined> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      if (sensitiveField.test(key)) continue;
      if (typeof fieldValue === 'string' || typeof fieldValue === 'number' || typeof fieldValue === 'boolean' || fieldValue === undefined) {
        safe[key] = fieldValue;
      }
    }
    return safe;
  }

  private write(level: 'info' | 'error' | 'warn' | 'debug' | 'verbose', message: string, fields?: LogFields): void {
    if (this.levels.indexOf(level) > this.levels.indexOf(this.minimumLevel)) return;
    const record = JSON.stringify({ ...fields, timestamp: new Date().toISOString(), level, message });
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(`${record}\n`);
  }
}
