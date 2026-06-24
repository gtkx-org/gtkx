import { getConfig } from "./config.js";

export const wrapEvent = (body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve().then(async () => {
        let pending: PromiseLike<void> | undefined;
        await getConfig().eventWrapper(() => {
            pending = body() ?? undefined;
        });
        await pending;
    });
