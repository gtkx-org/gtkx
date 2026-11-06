import type { Plugin } from "vitest/config";
import { WORKER_PRELOAD_ARGS } from "../internal/worker-preload-args.js";

function gtkxWorkerPreload(): Plugin {
    return {
        name: "gtkx:worker-preload",
        config: () => ({ test: { execArgv: [...WORKER_PRELOAD_ARGS] } }),
    };
}

export { gtkxWorkerPreload };
