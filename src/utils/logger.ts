enum LogLevel {
	ERROR = 'error',
	WARN = 'warn',
	INFO = 'info',
	DEBUG = 'debug',
}

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: string;
	error?: any;
}

class Logger {
	private isProduction = process.env.NODE_ENV === 'production';
	private shouldLogDebug = process.env.DEBUG === 'true';

	private formatLog(entry: LogEntry): string {
		const { level, message, timestamp, context, error } = entry;

		if (this.isProduction) {
			// В продакшене логируем в JSON формате для систем мониторинга
			return JSON.stringify({
				level,
				message,
				timestamp,
				context,
				...(error && { error: error.message, stack: error.stack }),
			});
		} else {
			// В разработке читаемый формат
			const prefix = context ? `[${context}]` : '';
			return `${timestamp} ${level.toUpperCase()} ${prefix} ${message}${
				error ? ` - ${error.message}` : ''
			}`;
		}
	}

	private log(level: LogLevel, message: string, context?: string, error?: any) {
		// В продакшене показываем только важные логи
		if (this.isProduction && level === LogLevel.DEBUG) {
			return;
		}

		// В разработке показываем debug только при включенном флаге
		if (
			!this.isProduction &&
			level === LogLevel.DEBUG &&
			!this.shouldLogDebug
		) {
			return;
		}

		const entry: LogEntry = {
			level,
			message,
			timestamp: new Date().toISOString(),
			context,
			error,
		};

		const formattedLog = this.formatLog(entry);

		switch (level) {
			case LogLevel.ERROR:
				console.error(formattedLog);
				break;
			case LogLevel.WARN:
				console.warn(formattedLog);
				break;
			case LogLevel.INFO:
				console.log(formattedLog);
				break;
			case LogLevel.DEBUG:
				console.debug(formattedLog);
				break;
		}
	}

	error(message: string, context?: string, error?: any) {
		this.log(LogLevel.ERROR, message, context, error);
	}

	warn(message: string, context?: string) {
		this.log(LogLevel.WARN, message, context);
	}

	info(message: string, context?: string) {
		this.log(LogLevel.INFO, message, context);
	}

	debug(message: string, context?: string) {
		this.log(LogLevel.DEBUG, message, context);
	}

	// Специальные методы для важных системных событий
	startup(message: string) {
		this.info(`🚀 ${message}`, 'STARTUP');
	}

	shutdown(message: string) {
		this.info(`🔻 ${message}`, 'SHUTDOWN');
	}

	performance(message: string, duration?: number) {
		if (duration && duration > 500) {
			this.warn(`⚠️ ${message} (${duration}ms)`, 'PERFORMANCE');
		}
	}
}

export const logger = new Logger();
