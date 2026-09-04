import { info } from "@gtkx/utils";
import { findStaleHeadlessDisplays, reapStaleHeadlessDisplays } from "@gtkx/vitest/headless";
import { defineCommand } from "citty";
import { cwdArg } from "../internal/entry-arg.js";

const cleanup = defineCommand({
    meta: {
        name: "cleanup",
        description: "Remove stale GTKX headless runtime directories",
    },
    args: {
        "dry-run": {
            type: "boolean",
            description: "List stale headless runtime directories without removing them",
        },
        ...cwdArg,
    },
    run({ args }) {
        const candidates = findStaleHeadlessDisplays();

        for (const candidate of candidates) {
            info(`cleanup: ${candidate.runtimeDir}`);
        }

        if (args["dry-run"] === true) {
            info(`cleanup: found ${String(candidates.length)} stale headless runtime directories`);

            return;
        }

        const removed = reapStaleHeadlessDisplays(candidates);
        info(`cleanup: removed ${String(removed.length)} stale headless runtime directories`);
    },
});

export { cleanup };
