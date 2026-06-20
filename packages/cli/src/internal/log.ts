const PREFIX = "[gtkx]";

export const info = (message: string, ...rest: unknown[]): void => console.log(`${PREFIX} ${message}`, ...rest);

export const warn = (message: string, ...rest: unknown[]): void => console.warn(`${PREFIX} ${message}`, ...rest);

export const error = (message: string, ...rest: unknown[]): void => console.error(`${PREFIX} ${message}`, ...rest);
