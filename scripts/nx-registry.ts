import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { spawnWithParentDeathSignal } from "../packages/utils/src/process/spawn-with-parent-death-signal.ts";

type RegistryStartup = {
    output: string;
    hasStarted: boolean;
    failure?: Error | undefined;
};

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const STARTUP_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 5000;

function observeRegistry(child: ChildProcess, registry: string, port: number): RegistryStartup {
    const state: RegistryStartup = { output: "", hasStarted: false };

    const capture = (chunk: Buffer): void => {
        process.stdout.write(chunk);
        state.output = `${state.output}${stripVTControlCharacters(chunk.toString("utf8"))}`.slice(-16_384);

        if (state.output.includes(`Port ${String(port)} was occupied.`)) {
            state.failure = new Error(`Cannot start local registry: port ${String(port)} is occupied`);
        }

        state.hasStarted = state.output.includes(`http address - ${registry}`);
    };

    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.once("error", (error) => {
        state.failure = error;
    });
    child.once("close", (code, signal) => {
        state.failure = new Error(
            `Local registry exited (code ${String(code)}, signal ${String(signal)}):\n${state.output}`,
        );
    });

    return state;
}

function assertRegistryRunning(state: RegistryStartup): void {
    if (state.failure !== undefined) {
        throw state.failure;
    }
}

async function waitForRegistry(state: RegistryStartup, registry: string): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;

    while (Date.now() < deadline) {
        assertRegistryRunning(state);

        if (state.hasStarted) {
            try {
                const response = await fetch(`${registry}-/ping`, { signal: AbortSignal.timeout(1000) });
                await response.arrayBuffer();

                if (response.ok) {
                    assertRegistryRunning(state);

                    return;
                }
            } catch {
                await delay(100);
            }
        }

        await delay(100);
    }

    throw new Error(`Local registry did not become ready in time:\n${state.output}`);
}

function registryStop(child: ChildProcess): () => Promise<void> {
    const closed: Promise<void> = new Promise((resolve) => {
        child.once("close", () => {
            resolve();
        });
    });

    return async () => {
        child.kill("SIGTERM");
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
        }, SHUTDOWN_TIMEOUT_MS);

        try {
            await closed;
        } finally {
            clearTimeout(timer);
        }
    };
}

async function startNxRegistry(registryDir: string, port: number): Promise<() => Promise<void>> {
    const nxBin = fileURLToPath(import.meta.resolve("nx/bin/nx.js"));
    const child = spawnWithParentDeathSignal(
        "env",
        [
            "--chdir", ROOT_DIR,
            process.execPath, nxBin,
            "run", "gtkx:local-registry",
            "--port", String(port),
            "--storage", join(registryDir, "storage"),
            "--location", "none",
            "--clear", "true",
            "--outputStyle", "stream",
        ],
        {
            env: { ...process.env, NX_DAEMON: "false", NX_TUI: "false", FORCE_COLOR: "0" },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    const registry = `http://127.0.0.1:${String(port)}/`;
    const state = observeRegistry(child, registry, port);
    const stop = registryStop(child);

    try {
        await waitForRegistry(state, registry);

        return stop;
    } catch (error) {
        await stop();
        throw error;
    }
}

export { startNxRegistry };
