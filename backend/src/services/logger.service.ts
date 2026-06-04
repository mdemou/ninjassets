import config from '@config/config';
import pino from 'pino';

const pinoLog = pino({
  name: config.appName,
  level: config.logLevel,
  timestamp: () => `,"humanDate":"${new Date().toISOString()}"`,
});

function formatResponse(fileName: string, methodName: string, logItem?: unknown) {
  const extra =
    logItem !== undefined
      ? typeof logItem === 'object' && logItem !== null
        ? JSON.stringify(logItem, Object.getOwnPropertyNames(logItem))
        : JSON.stringify(logItem)
      : {};
  return {
    filename: fileName.slice(fileName.lastIndexOf('/') + 1, -3),
    methodName,
    extra,
  };
}

const logger = {
  trace: (fileName: string, methodName: string, message: string, logItem?: unknown) => {
    return pinoLog.trace(formatResponse(fileName, methodName, logItem), message);
  },
  debug: (fileName: string, methodName: string, message: string, logItem?: unknown) => {
    return pinoLog.debug(formatResponse(fileName, methodName, logItem), message);
  },
  info: (fileName: string, methodName: string, message: string, logItem?: unknown) => {
    return pinoLog.info(formatResponse(fileName, methodName, logItem), message);
  },
  warn: (fileName: string, methodName: string, message: string, logItem?: unknown) => {
    return pinoLog.warn(formatResponse(fileName, methodName, logItem), message);
  },
  error: (fileName: string, methodName: string, message: string, logItem?: unknown) => {
    return pinoLog.error(formatResponse(fileName, methodName, logItem), message);
  },
  fatal: (fileName: string, methodName: string, message: string, logItem?: unknown) => {
    return pinoLog.fatal(formatResponse(fileName, methodName, logItem), message);
  },
};

export default logger;
