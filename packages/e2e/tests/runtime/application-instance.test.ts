import type * as Gio from "@gtkx/gi/gio";
import { getApplicationInstance, quitApplication, runApplication } from "@gtkx/runtime";
import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createUniqueApplication } from "../helpers/application.js";
import { createAppIdFactory } from "../helpers/unique-name.js";

type Owner = {
    process: ChildProcess;
    output: () => string;
};

const OWNER_FIXTURE = fileURLToPath(new URL("../fixtures/application-owner.ts", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OWNED_MARKER = "OWNER isPrimary=true";
const OWNED_TIMEOUT_MS = 20_000;
const uniqueAppId = createAppIdFactory("org.gtkx.instance");
const owners: Owner[] = [];
const started: Gio.Application[] = [];

const trackUniqueApplication = (applicationId: string): Gio.Application => {
    const application = createUniqueApplication(applicationId);
    started.push(application);

    return application;
};

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

const startOwner = async (applicationId: string): Promise<void> => {
    const child = spawn(process.execPath, ["--conditions=source", "--import", "tsx", OWNER_FIXTURE, applicationId], {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
    });

    const owner: Owner = { process: child, output: collectOutput(child) };
    owners.push(owner);
    await waitForOwnedId(owner);
};

afterEach(() => {
    const applications = [...started];
    const running = [...owners];
    started.length = 0;
    owners.length = 0;

    for (const application of applications) {
        quitApplication(application);
    }

    for (const owner of running) {
        owner.process.kill("SIGKILL");
    }
});

describe("getApplicationInstance", () => {
    it("reports a primary instance for the process that owns the application ID", () => {
        const application = trackUniqueApplication(uniqueAppId());
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(getApplicationInstance(application)).toBe("primary");
    });

    it("reports a remote instance when another process already owns the application ID", async () => {
        const applicationId = uniqueAppId();
        await startOwner(applicationId);
        const application = trackUniqueApplication(applicationId);
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: false, exitStatus: 0 });
        expect(application.getIsRegistered()).toBe(true);
        expect(getApplicationInstance(application)).toBe("remote");
    });

    it("reports an unregistered instance for an application that never ran", () => {
        const application = trackUniqueApplication(uniqueAppId());
        expect(application.getIsRegistered()).toBe(false);
        expect(getApplicationInstance(application)).toBe("unregistered");
    });
});
