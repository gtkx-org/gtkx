import * as p from "@clack/prompts";

export const intro = (message: string): void => {
    p.intro(message);
};

export const outro = (message: string): void => {
    p.outro(message);
};

export const log = {
    info: (message: string): void => p.log.info(message),
    success: (message: string): void => p.log.success(message),
    warning: (message: string): void => p.log.warning(message),
    error: (message: string): void => p.log.error(message),
    step: (message: string): void => p.log.step(message),
    message: (message: string): void => p.log.message(message),
};

export type SpinnerHandle = {
    stop: (message?: string) => void;
    message: (message: string) => void;
};

export const spinner = (message: string): SpinnerHandle => {
    const s = p.spinner();
    s.start(message);
    return {
        stop: (msg?: string) => s.stop(msg ?? message),
        message: (msg: string) => s.message(msg),
    };
};
