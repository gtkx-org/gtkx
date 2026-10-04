import type { ChildProcess } from "node:child_process";
import { spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";
import { collectOutput, waitForMarker } from "./child-output.js";

const OWNER_FIXTURE = fileURLToPath(new URL("../fixtures/application-owner.ts", import.meta.url));
const TSX_LOADER = new URL("../../../../scripts/tsx.ts", import.meta.url).href;
const OWNER_ARGS = ["--import", TSX_LOADER, OWNER_FIXTURE];
const OWNED_MARKER = "OWNER isPrimary=true";
const OWNED_SUBJECT = "the application owner";
const OWNED_TIMEOUT_MS = 20_000;
const owners: ChildProcess[] = [];

const startApplicationOwner = async (applicationId: string): Promise<void> => {
    const child = spawnWithParentDeathSignal(process.execPath, [...OWNER_ARGS, applicationId], {
        stdio: ["ignore", "pipe", "pipe"],
    });

    owners.push(child);

    await waitForMarker({
        child,
        read: collectOutput(child),
        marker: OWNED_MARKER,
        subject: OWNED_SUBJECT,
        timeoutMs: OWNED_TIMEOUT_MS,
    });
};

const stopApplicationOwners = (): void => {
    const running = [...owners];
    owners.length = 0;

    for (const child of running) {
        child.kill("SIGKILL");
    }
};

export { startApplicationOwner, stopApplicationOwners };
