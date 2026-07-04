import { runInAct } from "../act.js";

export const wrapEvent = (body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve().then(() =>
        runInAct(async () => {
            await body();
        }),
    );
