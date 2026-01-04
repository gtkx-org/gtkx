import * as p from "@clack/prompts";

/**
 * Displays an intro message for a CLI operation.
 *
 * @param message - The intro text to display
 */
export const intro = (message: string): void => {
    p.intro(message);
};

/**
 * Displays an outro message for a CLI operation.
 *
 * @param message - The outro text to display
 */
export const outro = (message: string): void => {
    p.outro(message);
};

/**
 * Logging utilities for CLI output.
 */
export const log = {
    /** Display an info message */
    info: (message: string): void => p.log.info(message),
    /** Display a success message */
    success: (message: string): void => p.log.success(message),
    /** Display a warning message */
    warning: (message: string): void => p.log.warning(message),
    /** Display an error message */
    error: (message: string): void => p.log.error(message),
    /** Display a step message */
    step: (message: string): void => p.log.step(message),
    /** Display a generic message */
    message: (message: string): void => p.log.message(message),
};

/**
 * Handle returned by {@link spinner} for controlling a spinner.
 */
export type SpinnerHandle = {
    /** Stop the spinner and display a completion message */
    stop: (message?: string) => void;
    /** Update the spinner message while running */
    message: (message: string) => void;
};

/**
 * Creates and starts a loading spinner.
 *
 * @param message - Initial spinner message
 * @returns Handle to control the spinner
 */
export const spinner = (message: string): SpinnerHandle => {
    const s = p.spinner();
    s.start(message);
    return {
        stop: (msg?: string) => s.stop(msg ?? message),
        message: (msg: string) => s.message(msg),
    };
};
