const WORKER_PRELOAD_ARGS: readonly string[] = ["--import", new URL("../worker-preload.js", import.meta.url).href];

export { WORKER_PRELOAD_ARGS };
