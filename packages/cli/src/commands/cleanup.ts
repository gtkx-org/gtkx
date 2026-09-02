import { info } from "@gtkx/utils";
import { findLegacyHeadlessDisplays, reapLegacyHeadlessDisplays } from "@gtkx/vitest/headless";
import { defineCommand } from "citty";
import { cwdArg } from "../internal/entry-arg.js";

type CleanupCandidate = ReturnType<typeof findLegacyHeadlessDisplays>[number];

const requestedProcessId = (shouldSelectAll: boolean, value: string | undefined): number | undefined => {
    if (shouldSelectAll && value !== undefined) {
        throw new Error("Pass either --all or --pid, not both");
    }

    const pid = value === undefined ? undefined : Number(value);

    if (pid !== undefined && (!Number.isSafeInteger(pid) || pid < 2)) {
        throw new Error("--pid must be a positive process ID");
    }

    return pid;
};

const selectedCandidates = (
    candidates: CleanupCandidate[],
    shouldSelectAll: boolean,
    pid: number | undefined,
): CleanupCandidate[] =>
    shouldSelectAll || pid === undefined ? candidates : candidates.filter((candidate) => candidate.pid === pid);

const reportCandidates = (candidates: CleanupCandidate[]): void => {
    for (const candidate of candidates) {
        info(`cleanup: ${String(candidate.pid)} ${candidate.runtimeDir}`);
    }
};

const cleanup = defineCommand({
    meta: {
        name: "cleanup",
        description: "Find or reap orphaned GTKX headless displays",
    },
    args: {
        all: {
            type: "boolean",
            description: "Reap every verified orphaned headless display",
        },
        pid: {
            type: "string",
            description: "Reap the verified orphaned headless display with this process ID",
        },
        "dry-run": {
            type: "boolean",
            description: "List matching displays without reaping them",
        },
        ...cwdArg,
    },
    run({ args }) {
        const candidates = findLegacyHeadlessDisplays();
        const shouldSelectAll = args.all === true;
        const requestedPid = requestedProcessId(shouldSelectAll, args.pid);
        const selected = selectedCandidates(candidates, shouldSelectAll, requestedPid);
        reportCandidates(selected);

        if ((requestedPid === undefined && !shouldSelectAll) || args["dry-run"]) {
            info(`cleanup: found ${String(selected.length)} verified orphaned headless displays`);

            return;
        }

        if (requestedPid !== undefined && selected.length === 0) {
            throw new Error(`Process ${String(requestedPid)} is not a verified GTKX headless display`);
        }

        reapLegacyHeadlessDisplays(selected);
        info(`cleanup: reaped ${String(selected.length)} verified orphaned headless displays`);
    },
});

export { cleanup };
