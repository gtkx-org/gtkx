import { spawn } from "node:child_process";

const display = 100 + (process.pid % 5000);

const xvfb = spawn("Xvfb", [`:${display}`, "-screen", "0", "1024x768x24"], {
    stdio: "ignore",
    detached: true,
});

xvfb.unref();

process.env.GDK_BACKEND = "x11";
process.env.GSK_RENDERER = "cairo";
process.env.LIBGL_ALWAYS_SOFTWARE = "1";
process.env.DISPLAY = `:${display}`;
