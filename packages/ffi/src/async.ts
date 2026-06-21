import { tryGetHandle } from "./registry.js";

type AsyncStartFn = (...args: unknown[]) => void;

type AsyncFinishFn = (result: object) => unknown;

export type PromisifyArgs = {
    leading: unknown[];
    trailing?: unknown[];
};

const PROMISE_CREATION_MARKER = "### Promise created here: ###";

const spliceCreationStack = (error: unknown, creationStack: string | undefined): void => {
    if (!(error instanceof Error) || creationStack === undefined) return;
    const callerFrames = creationStack.split("\n").slice(2).join("\n");
    error.stack = `${error.stack ?? ""}\n${PROMISE_CREATION_MARKER}\n${callerFrames}`;
};

/**
 * Bridges a GIO-style async start/finish pair into a Promise.
 *
 * Forwards `leading` arguments, the resolved `cancellable` handle, optional
 * `trailing` arguments, and a completion callback to `asyncFn`, then resolves
 * with the result of `finish` once the operation completes. If `finish` throws,
 * the rejected error's stack is augmented with the call site that started the
 * operation under a `### Promise created here: ###` marker so failures inside
 * the GLib completion callback remain traceable.
 */
export const promisify = (
    asyncFn: AsyncStartFn,
    finish: AsyncFinishFn,
    cancellable: object | null | undefined,
    args: PromisifyArgs,
): Promise<unknown> =>
    new Promise((resolve, reject) => {
        const creationError = new Error();
        asyncFn(
            ...args.leading,
            tryGetHandle(cancellable),
            ...(args.trailing ?? []),
            (_source: object | null, asyncResult: object) => {
                try {
                    resolve(finish(asyncResult));
                } catch (error) {
                    spliceCreationStack(error, creationError.stack);
                    reject(error);
                }
            },
        );
    });
