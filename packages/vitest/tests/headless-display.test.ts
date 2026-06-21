import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();
    return { ...actual, spawn: vi.fn() };
});

const { spawn: realSpawn } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
const { startCompositor, waitForSocket, writeBusConfig } = await import("../src/headless-display.js");

const spawnMock = vi.mocked(spawn);

const spawnIdleChild = (): ChildProcess => realSpawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);

describe("startCompositor", () => {
    let runtimeDir: string;
    let children: ChildProcess[];
    const wlrKeys = [
        "WLR_BACKENDS",
        "WLR_RENDERER",
        "WLR_RENDERER_ALLOW_SOFTWARE",
        "WLR_LIBINPUT_NO_DEVICES",
        "WLR_HEADLESS_OUTPUTS",
    ];

    beforeEach(() => {
        runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-test-"));
        children = [];
        spawnMock.mockReset();
        spawnMock.mockImplementation(() => {
            const child = spawnIdleChild();
            children.push(child);
            return child;
        });
        for (const key of wlrKeys) delete process.env[key];
    });

    afterEach(() => {
        for (const child of children) child.kill("SIGKILL");
        rmSync(runtimeDir, { recursive: true, force: true });
        for (const key of wlrKeys) delete process.env[key];
        spawnMock.mockReset();
    });

    it("selects the wayland-1 socket and sets the WLR_* env for sway", () => {
        const result = startCompositor(runtimeDir, { size: "800x600", compositor: "sway" });

        expect(result.socket).toBe("wayland-1");
        expect(process.env["WLR_BACKENDS"]).toBe("headless");
        expect(process.env["WLR_RENDERER"]).toBe("pixman");
        expect(process.env["WLR_RENDERER_ALLOW_SOFTWARE"]).toBe("1");
        expect(process.env["WLR_LIBINPUT_NO_DEVICES"]).toBe("1");
        expect(process.env["WLR_HEADLESS_OUTPUTS"]).toBe("1");
    });

    it("selects the wayland-0 socket for weston without WLR_* env", () => {
        const result = startCompositor(runtimeDir, { size: "800x600", compositor: "weston" });

        expect(result.socket).toBe("wayland-0");
        expect(process.env["WLR_BACKENDS"]).toBeUndefined();
    });

    it("passes the requested size through to the weston spawn arguments", () => {
        startCompositor(runtimeDir, { size: "640x480", compositor: "weston" });

        const args = spawnMock.mock.calls[0]?.[1] ?? [];
        expect(args).toContain("--width=640");
        expect(args).toContain("--height=480");
    });
});

describe("writeBusConfig", () => {
    let runtimeDir: string;

    beforeEach(() => {
        runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-test-"));
    });

    afterEach(() => {
        rmSync(runtimeDir, { recursive: true, force: true });
    });

    it("renders the listen path, EXTERNAL auth, and policy lines", () => {
        const configPath = join(runtimeDir, "session.conf");
        const socketPath = join(runtimeDir, "bus");

        writeBusConfig(configPath, socketPath);
        const xml = readFileSync(configPath, "utf8");

        expect(xml).toContain(`<listen>unix:path=${socketPath}</listen>`);
        expect(xml).toContain("<auth>EXTERNAL</auth>");
        expect(xml).toContain('<allow own="*"/>');
        expect(xml).toContain('<policy context="default">');
    });
});

describe("waitForSocket", () => {
    let runtimeDir: string;
    let children: ChildProcess[];

    beforeEach(() => {
        runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-test-"));
        children = [];
    });

    afterEach(() => {
        for (const child of children) child.kill("SIGKILL");
        rmSync(runtimeDir, { recursive: true, force: true });
    });

    it("resolves once the target path appears", async () => {
        const target = join(runtimeDir, "appears");
        const pending = waitForSocket(target, { label: "Test", timeout: 2000 });
        expect(existsSync(target)).toBe(false);
        writeBusConfig(target, target);

        await expect(pending).resolves.toBeUndefined();
    });

    it("rejects with the captured child stderr when the child exits first", async () => {
        const child = realSpawn(process.execPath, [
            "-e",
            "process.stderr.write('boom on startup\\n'); process.exit(1);",
        ]);
        children.push(child);
        const target = join(runtimeDir, "never");

        await expect(waitForSocket(target, { label: "Compositor", timeout: 2000, child })).rejects.toThrow(
            /Compositor exited \(code 1, signal null\)[\s\S]*boom on startup/,
        );
    });

    it("rejects on timeout when the path never appears", async () => {
        const target = join(runtimeDir, "missing");
        await expect(waitForSocket(target, { label: "D-Bus session bus", timeout: 60 })).rejects.toThrow(
            /D-Bus session bus did not become available within 60ms/,
        );
    });
});
