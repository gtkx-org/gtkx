import type { ChildProcess } from "node:child_process";
import { spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";

type Owner = {
    process: ChildProcess;
    output: () => string;
};

const OWNER_FIXTURE = fileURLToPath(new URL("../fixtures/application-owner.ts", import.meta.url));
const OWNER_ARGS = ["--conditions=source", "--import", "tsx", OWNER_FIXTURE];
const OWNED_MARKER = "OWNER isPrimary=true";
const OWNED_TIMEOUT_MS = 20_000;
const owners: Owner[] = [];

const collectOutput = (child: ChildProcess): (() => string) => {
    let buffer = "";

    const append = (chunk: Buffer): void => {
        buffer += chunk.toString();
    };

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    return () => buffer;
};

const waitForOwnedId = (owner: Owner): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`owner did not take the application ID:\n${owner.output()}`));
        }, OWNED_TIMEOUT_MS);

        const check = (): void => {
            if (!owner.output().includes(OWNED_MARKER)) {
                return;
            }

            clearTimeout(timer);
            resolve();
        };

        owner.process.stdout?.on("data", check);

        owner.process.once("exit", () => {
            clearTimeout(timer);
            reject(new Error(`owner exited before it took the application ID:\n${owner.output()}`));
        });
    });

const startApplicationOwner = async (applicationId: string): Promise<void> => {
    const child = spawnWithParentDeathSignal(process.execPath, [...OWNER_ARGS, applicationId], {
        stdio: ["ignore", "pipe", "pipe"],
    });

    const owner: Owner = { process: child, output: collectOutput(child) };
    owners.push(owner);
    await waitForOwnedId(owner);
};

const stopApplicationOwners = (): void => {
    const running = [...owners];
    owners.length = 0;

    for (const owner of running) {
        owner.process.kill("SIGKILL");
    }
};

export { startApplicationOwner, stopApplicationOwners };
