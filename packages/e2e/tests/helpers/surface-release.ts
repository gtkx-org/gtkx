import { exitCodeForSignal, spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";
import { collectOutput } from "./child-output.js";

type Scenario = "held" | "predestroyed" | "undestroyed";

type SurfaceReleaseRun = {
    exitCode: number;
    output: string;
};

const FIXTURE = fileURLToPath(new URL("../fixtures/surface-release.ts", import.meta.url));
const FIXTURE_ARGS = ["--conditions=source", "--import", "tsx", "--expose-gc", FIXTURE];

const withFatalWarnings = (): NodeJS.ProcessEnv => ({ ...process.env, G_DEBUG: "fatal-warnings" });

const runSurfaceRelease = (scenario: Scenario): Promise<SurfaceReleaseRun> => {
    const child = spawnWithParentDeathSignal(process.execPath, [...FIXTURE_ARGS, scenario], {
        env: withFatalWarnings(),
        stdio: ["ignore", "pipe", "pipe"],
    });

    const read = collectOutput(child);

    return new Promise((resolve) => {
        child.once("close", (code, signal) => {
            resolve({ exitCode: code ?? exitCodeForSignal(signal), output: read() });
        });
    });
};

export { runSurfaceRelease };
