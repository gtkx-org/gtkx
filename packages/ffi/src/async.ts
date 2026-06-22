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
