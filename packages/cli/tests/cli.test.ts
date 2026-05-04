import type { ChildProcess } from "node:child_process";
import { fork } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
    fork: vi.fn(),
}));

vi.mock("../src/builder.js", () => ({
    build: vi.fn(async () => undefined),
}));

vi.mock("../src/codegen/run-codegen.js", () => ({
    preflightCodegen: vi.fn(async () => undefined),
    runCodegen: vi.fn(async () => ({
        ran: true,
        configFile: "/project/gtkx.config.ts",
        config: { libraries: ["Gtk-4.0", "Adw-1"] },
        girPath: ["/usr/share/gir-1.0"],
        namespaces: 2,
        widgets: 142,
        duration: 250,
    })),
}));

vi.mock("../src/create.js", () => ({
    createApp: vi.fn(async () => undefined),
}));

import { build } from "../src/builder.js";
import { buildCmd, codegen, create, dev, exitCodeForSignal } from "../src/cli.js";
import { preflightCodegen, runCodegen } from "../src/codegen/run-codegen.js";
import { createApp } from "../src/create.js";
import { RELOAD_EXIT_CODE } from "../src/dev-protocol.js";

const buildMock = vi.mocked(build);
const preflightMock = vi.mocked(preflightCodegen);
const runCodegenMock = vi.mocked(runCodegen);
const createAppMock = vi.mocked(createApp);
const forkMock = vi.mocked(fork);

type CommandRun<Args extends Record<string, unknown>> = (ctx: { args: Args }) => Promise<unknown>;

type FakeChild = EventEmitter & { killed: boolean; kill: ReturnType<typeof vi.fn> };

function createFakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild;
    child.killed = false;
    child.kill = vi.fn((_signal?: NodeJS.Signals) => {
        child.killed = true;
        return true;
    });
    return child;
}

describe("exitCodeForSignal", () => {
    it("returns 0 when no signal", () => {
        expect(exitCodeForSignal(null)).toBe(0);
    });

    it("returns 130 for SIGINT", () => {
        expect(exitCodeForSignal("SIGINT")).toBe(130);
    });

    it("returns 143 for SIGTERM", () => {
        expect(exitCodeForSignal("SIGTERM")).toBe(143);
    });

    it("returns 143 for any other signal", () => {
        expect(exitCodeForSignal("SIGHUP")).toBe(143);
    });
});

describe("buildCmd", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it("runs codegen preflight and builds with the default entry", async () => {
        const run = buildCmd.run as unknown as CommandRun<{ entry?: string; "asset-base"?: string }>;

        await run({ args: {} });

        expect(preflightMock).toHaveBeenCalledOnce();
        expect(buildMock).toHaveBeenCalledOnce();
        const buildCall = buildMock.mock.calls[0];
        if (!buildCall) throw new Error("build was not invoked");
        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/index\.tsx$/);
        expect(buildArgs.assetBase).toBeUndefined();
    });

    it("forwards a custom entry and asset-base flag", async () => {
        const run = buildCmd.run as unknown as CommandRun<{ entry?: string; "asset-base"?: string }>;

        await run({ args: { entry: "src/main.tsx", "asset-base": "../share/myapp" } });

        const buildCall = buildMock.mock.calls[0];
        if (!buildCall) throw new Error("build was not invoked");
        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/main\.tsx$/);
        expect(buildArgs.assetBase).toBe("../share/myapp");
    });
});

describe("create", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("delegates to createApp with normalized options", async () => {
        const run = create.run as unknown as CommandRun<{
            name?: string;
            "app-id"?: string;
            pm?: string;
            testing?: string;
            "claude-skills"?: boolean;
        }>;

        await run({
            args: {
                name: "my-app",
                "app-id": "com.example.myapp",
                pm: "pnpm",
                testing: "vitest",
                "claude-skills": true,
            },
        });

        expect(createAppMock).toHaveBeenCalledWith({
            name: "my-app",
            appId: "com.example.myapp",
            packageManager: "pnpm",
            testing: "vitest",
            claudeSkills: true,
        });
    });

    it("passes undefined for unspecified flags", async () => {
        const run = create.run as unknown as CommandRun<{
            name?: string;
            "app-id"?: string;
            pm?: string;
            testing?: string;
            "claude-skills"?: boolean;
        }>;

        await run({ args: {} });

        expect(createAppMock).toHaveBeenCalledWith({
            name: undefined,
            appId: undefined,
            packageManager: undefined,
            testing: undefined,
            claudeSkills: undefined,
        });
    });
});

describe("codegen command", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it("logs the up-to-date message and skips reporting when nothing ran", async () => {
        runCodegenMock.mockResolvedValueOnce({ ran: false } as never);
        const run = codegen.run as unknown as CommandRun<{ force?: boolean; cwd?: string }>;

        await run({ args: {} });

        const logged = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(logged).toContain("up to date");
        expect(logged).not.toContain("namespaces");
    });

    it("logs config, libraries, gir path, and totals after a successful run", async () => {
        const run = codegen.run as unknown as CommandRun<{ force?: boolean; cwd?: string }>;

        await run({ args: {} });

        expect(runCodegenMock).toHaveBeenCalledWith({ cwd: process.cwd(), force: undefined });

        const logged = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(logged).toContain("config=/project/gtkx.config.ts");
        expect(logged).toContain("libraries=Gtk-4.0, Adw-1");
        expect(logged).toContain("girPath=/usr/share/gir-1.0");
        expect(logged).toContain("2 namespaces, 142 widgets in 250ms");
    });

    it("forwards --force and --cwd flags", async () => {
        const run = codegen.run as unknown as CommandRun<{ force?: boolean; cwd?: string }>;

        await run({ args: { force: true, cwd: "/custom/dir" } });

        expect(runCodegenMock).toHaveBeenCalledWith({
            cwd: expect.stringContaining("custom/dir"),
            force: true,
        });
    });

    it("skips optional log lines when fields are missing from the result", async () => {
        runCodegenMock.mockResolvedValueOnce({
            ran: true,
            namespaces: 0,
            widgets: 0,
            duration: 5,
        } as never);
        const run = codegen.run as unknown as CommandRun<{ force?: boolean; cwd?: string }>;

        await run({ args: {} });

        const logged = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(logged).not.toContain("config=");
        expect(logged).not.toContain("libraries=");
        expect(logged).not.toContain("girPath=");
        expect(logged).toContain("0 namespaces, 0 widgets in 5ms");
    });
});

describe("dev command", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let prevSigInt: NodeJS.Signals[] | undefined;
    let prevSigTerm: NodeJS.Signals[] | undefined;
    let runDev: CommandRun<{ entry?: string }>;

    beforeEach(() => {
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        prevSigInt = process.listeners("SIGINT") as unknown as NodeJS.Signals[];
        prevSigTerm = process.listeners("SIGTERM") as unknown as NodeJS.Signals[];
        runDev = dev.run as unknown as CommandRun<{ entry?: string }>;
    });

    afterEach(() => {
        logSpy.mockRestore();
        exitSpy.mockRestore();
        const newSigInt = process.listeners("SIGINT") as unknown as NodeJS.Signals[];
        for (const listener of newSigInt) {
            if (!prevSigInt?.includes(listener)) {
                process.removeListener("SIGINT", listener as never);
            }
        }
        const newSigTerm = process.listeners("SIGTERM") as unknown as NodeJS.Signals[];
        for (const listener of newSigTerm) {
            if (!prevSigTerm?.includes(listener)) {
                process.removeListener("SIGTERM", listener as never);
            }
        }
    });

    async function startDev(entry?: string): Promise<FakeChild> {
        const child = createFakeChild();
        forkMock.mockReturnValueOnce(child as unknown as ChildProcess);
        runDev({ args: entry ? { entry } : {} }).catch(() => undefined);
        await preflightMock.mock.results[0]?.value;
        await Promise.resolve();
        return child;
    }

    it("runs preflight codegen and forks the dev runner with the resolved entry", async () => {
        await startDev("src/main.tsx");

        expect(preflightMock).toHaveBeenCalledOnce();
        expect(forkMock).toHaveBeenCalledOnce();
        const [, args] = forkMock.mock.calls[0] ?? [];
        expect(Array.isArray(args) ? args[0] : undefined).toMatch(/src\/main\.tsx$/);
    });

    it("uses src/index.tsx as the default entry when no positional is supplied", async () => {
        await startDev();

        const [, args] = forkMock.mock.calls[0] ?? [];
        expect(Array.isArray(args) ? args[0] : undefined).toMatch(/src\/index\.tsx$/);
    });

    it("relaunches the runner when the child exits with the reload code", async () => {
        const child = await startDev();
        const second = createFakeChild();
        forkMock.mockReturnValueOnce(second as unknown as ChildProcess);

        child.emit("exit", RELOAD_EXIT_CODE, null);

        expect(forkMock).toHaveBeenCalledTimes(2);
        expect(exitSpy).not.toHaveBeenCalled();
        const logged = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(logged).toContain("Restarting dev runner");
    });

    it("exits with the child's code when the child exits non-reloadably", async () => {
        const child = await startDev();

        child.emit("exit", 7, null);

        expect(exitSpy).toHaveBeenCalledWith(7);
    });

    it("exits with the signal-mapped code when the child exits via signal", async () => {
        const child = await startDev();

        child.emit("exit", null, "SIGINT");

        expect(exitSpy).toHaveBeenCalledWith(130);
    });

    it("forwards SIGINT to the running child process", async () => {
        const child = await startDev();

        process.emit("SIGINT", "SIGINT");

        expect(child.kill).toHaveBeenCalledWith("SIGINT");
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("forwards SIGTERM to the running child process", async () => {
        const child = await startDev();

        process.emit("SIGTERM", "SIGTERM");

        expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("does not re-kill a child that already reports killed=true", async () => {
        const child = await startDev();
        child.killed = true;

        process.emit("SIGINT", "SIGINT");

        expect(child.kill).not.toHaveBeenCalled();
    });

    it("exits cleanly when a signal arrives after the child has already exited", async () => {
        const child = await startDev();
        child.emit("exit", 0, null);
        exitSpy.mockClear();

        process.emit("SIGINT", "SIGINT");

        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("ignores subsequent child exits once shutting down", async () => {
        const child = await startDev();

        process.emit("SIGINT", "SIGINT");
        exitSpy.mockClear();

        child.emit("exit", 99, null);

        expect(exitSpy).not.toHaveBeenCalled();
    });
});
