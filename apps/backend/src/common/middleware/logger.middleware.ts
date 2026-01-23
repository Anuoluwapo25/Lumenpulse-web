import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { formatHttpLog, getLogLevel, LogInfo } from '../utils/log-format.util';
import { getLoggingConfig, LoggingConfig } from '../config/logging.config';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly config: LoggingConfig = getLoggingConfig();

  use(req: Request, res: Response, next: NextFunction) {
    // Skip logging for excluded routes if enabled
    if (this.config.enabled && this.config.excludeRoutes?.includes(req.url)) {
      next();
      return;
    }

    // Only proceed with logging if enabled
    if (!this.config.enabled) {
      next();
      return;
    }

    const startTime = Date.now();
    const userAgent = this.config.includeUserAgent ? req.get('user-agent') || '' : undefined;
    
    // Capture the original res.end method to calculate duration
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      const duration = Date.now() - startTime;
      
      // Prepare log information
      const logInfo: LogInfo = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: duration,
        userAgent,
        ip: this.config.includeIP ? req.ip : undefined,
        timestamp: new Date().toISOString(),
      };

      // Check if we should log based on the configured level
      const logLevel = getLogLevel(res.statusCode);
      const shouldLog = 
        (this.config.level === 'log') ||
        (this.config.level === 'warn' && logLevel !== 'log') ||
        (this.config.level === 'error' && logLevel === 'error');

      if (shouldLog) {
        // Format and log the request details
        const logMessage = formatHttpLog(logInfo);

        // Use NestJS Logger for consistent formatting with appropriate log level
        switch (logLevel) {
          case 'error':
            Logger.error(logMessage, null, 'HTTP');
            break;
          case 'warn':
            Logger.warn(logMessage, 'HTTP');
            break;
          case 'log':
            Logger.log(logMessage, 'HTTP');
            break;
        }
      }
      
      // Call the original end method
      return originalEnd.call(this, chunk, encoding, callback);
    };
    
    next();
  }
}