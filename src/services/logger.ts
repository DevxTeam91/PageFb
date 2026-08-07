// Simple custom logger for observability (Phase 10)
// In a production app, this could send logs to Datadog, Sentry, or LogRocket.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class LoggerService {
  private log(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'debug':
        if (__DEV__) console.log(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        // e.g. Crashlytics.recordError(args[0])
        break;
    }
  }

  debug(message: string, ...args: any[]) { this.log('debug', message, ...args); }
  info(message: string, ...args: any[]) { this.log('info', message, ...args); }
  warn(message: string, ...args: any[]) { this.log('warn', message, ...args); }
  error(message: string, ...args: any[]) { this.log('error', message, ...args); }
}

export const logger = new LoggerService();
