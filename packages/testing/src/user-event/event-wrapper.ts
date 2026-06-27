import { runInAct } from "../act.js";

export const wrapEvent = (body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve().then(async () => {
        let pending: PromiseLike<void> | undefined;
        await runInAct(() => {
            pending = body() ?? undefined;
        });
        await pending;
    });
