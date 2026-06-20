import { tryGetHandle } from "./registry.js";

type AsyncStartFn = (...args: unknown[]) => void;

type AsyncFinishFn = (result: object) => unknown;

export type PromisifyArgs = {
    leading: unknown[];
    trailing?: unknown[];
};

export const promisify = (
    asyncFn: AsyncStartFn,
    finish: AsyncFinishFn,
    cancellable: object | null | undefined,
    args: PromisifyArgs,
): Promise<unknown> =>
    new Promise((resolve, reject) => {
        asyncFn(
            ...args.leading,
            tryGetHandle(cancellable),
            ...(args.trailing ?? []),
            (_source: object | null, asyncResult: object) => {
                try {
                    resolve(finish(asyncResult));
                } catch (error) {
                    reject(error);
                }
            },
        );
    });
