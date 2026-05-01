import type { Logger } from "../types/index.js";

/**
 * 默认日志实现
 */
export const defaultLogger: Logger = {
  info: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(msg),
  warn: (msg: string) => console.warn(msg),
  debug: (msg: string) => console.debug(msg),
};

/**
 * 创建一个空的日志实现（所有方法为空函数）
 */
export const noopLogger: Logger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
};
