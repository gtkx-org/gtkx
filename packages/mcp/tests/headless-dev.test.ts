import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveExecutable } from "@gtkx/utils";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    APPLICATION_ID,
    callText,
    callTool,
    createProject,
    type McpServer,
    startApp,
    startServer,
    stopApp,
} from "./app-session.js";

type SwayDisplay = { pid: number; runtimeDir: string };
type SwayOutput = { name?: string } & Partial<
    Record<"current_mode", { width?: number; height?: number }>
>;
type TestState = { app?: ChildProcess; project?: string; runtimeRoot?: string; server?: McpServer };

const APP_TIMEOUT_MS = 120_000;
const DISPLAY_TIMEOUT_MS = 30_000;
const DISPLAY_POLL_MS = 50;
const PNG_SIGNATURE = "89504e470d0a1a0a";
const state: TestState = {};

const processParent = (pid: number): number | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const parent = Number(fields[1]);

        return Number.isSafeInteger(parent) ? parent : undefined;
    } catch {
        return undefined;
    }
};

const readSwayDisplay = (entry: string, pid: number): SwayDisplay | undefined => {
    try {
        const args = readFileSync(`/proc/${entry}/cmdline`)
            .toString()
            .split("\0")
            .filter((argument) => argument.length > 0);
        const configPath = args[2] ?? "";

        return args.length === 3 && args[1] === "-c" && args[0]?.endsWith("/sway") === true
            ? { pid, runtimeDir: dirname(configPath) }
            : undefined;
    } catch {
        return undefined;
    }
};

const swayDisplayFor = (parentId: number): SwayDisplay | undefined =>
    readdirSync("/proc")
        .map((entry) => ({ entry, pid: Number(entry) }))
        .filter(({ pid }) => Number.isSafeInteger(pid) && processParent(pid) === parentId)
        .map(({ entry, pid }) => readSwayDisplay(entry, pid))
        .find((display) => display !== undefined);

const waitForSwayDisplay = async (parentId: number): Promise<SwayDisplay> => {
    const deadline = Date.now() + DISPLAY_TIMEOUT_MS;
    let display = swayDisplayFor(parentId);

    while (display === undefined && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, DISPLAY_POLL_MS));
        display = swayDisplayFor(parentId);
    }

    if (display === undefined) {
        throw new Error("Headless Sway display did not start");
    }

    return display;
};

const waitForRemoval = async (path: string): Promise<void> => {
    const deadline = Date.now() + DISPLAY_TIMEOUT_MS;

    while (existsSync(path) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, DISPLAY_POLL_MS));
    }
};

const imageSignature = (result: CallToolResult): string => {
    const image = result.content.find((entry) => entry.type === "image");

    return Buffer.from(image?.data ?? "", "base64").subarray(0, 8).toString("hex");
};

const outputDimensions = (display: SwayDisplay): { width: number; height: number } => {
    const socketName = readdirSync(display.runtimeDir).find(
        (entry) => entry.startsWith("sway-ipc.") && entry.endsWith(".sock"),
    );

    if (socketName === undefined) {
        throw new Error("Headless Sway IPC socket was not created");
    }

    const result = spawnSync(
        resolveExecutable("swaymsg"),
        ["--socket", join(display.runtimeDir, socketName), "--type", "get_outputs", "--raw"],
        { encoding: "utf8" },
    );
    const outputs = JSON.parse(result.stdout) as SwayOutput[];
    const output = outputs.find((candidate) => candidate.name === "HEADLESS-1");
    const mode = output?.current_mode;

    if (mode?.width === undefined || mode.height === undefined) {
        throw new Error("Headless Sway output has no active mode");
    }

    return { width: mode.width, height: mode.height };
};

const createLongRuntime = (): string => {
    state.runtimeRoot = mkdtempSync(join(tmpdir(), "gtkx-headless-runtime-"));
    const runtimeDir = join(state.runtimeRoot, "界".repeat(40));
    mkdirSync(runtimeDir);

    return runtimeDir;
};

afterEach(async () => {
    const app = state.app;

    if (app?.exitCode === null && app.signalCode === null) {
        await stopApp(app);
    }

    await state.server?.stop();

    if (state.project !== undefined) {
        rmSync(state.project, { recursive: true, force: true });
    }

    if (state.runtimeRoot !== undefined) {
        rmSync(state.runtimeRoot, { recursive: true, force: true });
    }

    Reflect.deleteProperty(state, "app");
    Reflect.deleteProperty(state, "project");
    Reflect.deleteProperty(state, "runtimeRoot");
    Reflect.deleteProperty(state, "server");
});

describe("gtkx dev --headless", () => {
    it("starts at the requested size and stays connected over a short private MCP socket", async () => {
        state.project = createProject();
        const runtimeDir = createLongRuntime();
        state.server = await startServer(state.project, runtimeDir);
        const screenshotPath = join(state.project, "headless.png");
        const screenshot = callTool(state.server.client, "gtkx_take_screenshot", {
            applicationId: APPLICATION_ID,
            appTimeout: APP_TIMEOUT_MS,
            path: screenshotPath,
        });
        state.app = startApp(state.project, runtimeDir, ["--headless", "--size", "800x600"]);
        const appPid = state.app.pid;

        if (appPid === undefined) {
            throw new Error("Headless dev process did not start");
        }

        const display = await waitForSwayDisplay(appPid);
        const result = await screenshot;
        expect(imageSignature(result)).toBe(PNG_SIGNATURE);
        expect(outputDimensions(display)).toEqual({ width: 800, height: 600 });
        expect(existsSync(screenshotPath)).toBe(true);
        await stopApp(state.app);
        await waitForRemoval(display.runtimeDir);
        expect(existsSync(display.runtimeDir)).toBe(false);
    }, APP_TIMEOUT_MS);
});

describe("a long MCP runtime path", () => {
    it("connects when the app starts before the server creates the fallback directory", async () => {
        state.project = createProject();
        const runtimeDir = createLongRuntime();
        state.app = startApp(state.project, runtimeDir);
        await new Promise((resolve) => setTimeout(resolve, 250));
        state.server = await startServer(state.project, runtimeDir);
        const tree = await callText(state.server.client, "gtkx_get_widget_tree", {
            applicationId: APPLICATION_ID,
            appTimeout: APP_TIMEOUT_MS,
        });
        expect(tree).toContain("<ApplicationWindow");
    }, APP_TIMEOUT_MS);
});
