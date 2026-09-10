import { info } from "@gtkx/utils";
import { findStaleHeadlessDisplays, reapStaleHeadlessDisplays } from "@gtkx/vitest/headless";
import { defineCommand } from "citty";
import { findStaleCompileCaches, reapStaleCompileCaches } from "../internal/compile-cache-store.js";
import { cwdArg } from "../internal/entry-arg.js";

const DISPLAY_LABEL = "stale headless runtime directories";
const COMPILE_CACHE_LABEL = "stale compile cache directories";

const report = (paths: string[]): void => {
    for (const path of paths) {
        info(`cleanup: ${path}`);
    }
};

const cleanup = defineCommand({
    meta: {
        name: "cleanup",
        description: "Remove stale GTKX headless runtime and compile cache directories",
    },
    args: {
        "dry-run": {
            type: "boolean",
            description: "List stale directories without removing them",
        },
        ...cwdArg,
    },
    run({ args }) {
        const displays = findStaleHeadlessDisplays();
        const compileCaches = findStaleCompileCaches();
        report(displays.map((candidate) => candidate.runtimeDir));
        report(compileCaches);

        if (args["dry-run"] === true) {
            info(`cleanup: found ${String(displays.length)} ${DISPLAY_LABEL}`);
            info(`cleanup: found ${String(compileCaches.length)} ${COMPILE_CACHE_LABEL}`);

            return;
        }

        const removedDisplays = reapStaleHeadlessDisplays(displays);
        const removedCaches = reapStaleCompileCaches(compileCaches);
        info(`cleanup: removed ${String(removedDisplays.length)} ${DISPLAY_LABEL}`);
        info(`cleanup: removed ${String(removedCaches.length)} ${COMPILE_CACHE_LABEL}`);
    },
});

export { cleanup };
