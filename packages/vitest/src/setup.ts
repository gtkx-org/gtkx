import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { beforeAll } from "vitest";

const display = 100 + (process.pid % 5000);
const socketPath = `/tmp/.X11-unix/X${display}`;

const xvfb = spawn("Xvfb", [`:${display}`, "-screen", "0", "1024x768x24"], {
    stdio: "ignore",
});

xvfb.unref();

process.env.GDK_BACKEND = "x11";
process.env.GSK_RENDERER = "cairo";
process.env.LIBGL_ALWAYS_SOFTWARE = "1";
process.env.DISPLAY = `:${display}`;

const killXvfb = (): void => {
    if (xvfb.pid !== undefined) {
        try {
            process.kill(xvfb.pid, "SIGTERM");
        } catch {}
    }
};

process.on("exit", killXvfb);

process.on("SIGTERM", () => {
    killXvfb();
    process.exit(143);
});

process.on("SIGINT", () => {
    killXvfb();
    process.exit(130);
});

const waitForDisplay = async (timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (existsSync(socketPath)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Xvfb display :${display} did not become available within ${timeout}ms`);
};

beforeAll(async () => {
    await waitForDisplay();
});
