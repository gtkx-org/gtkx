import { exitCodeForSignal, spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";
import { collectOutput } from "./child-output.js";

type Provocation = "critical" | "none" | "panic";
type Observation = "ignored" | "observed";

type ErrorChannelRun = {
    exitCode: number;
    observed: string | undefined;
    output: string;
};

const FIXTURE = fileURLToPath(new URL("../fixtures/native-error-channel.ts", import.meta.url));
const FIXTURE_ARGS = ["--conditions=source", "--import", "tsx", FIXTURE];
const OBSERVED_PREFIX = "OBSERVED ";

const withoutFatalCriticals = (): NodeJS.ProcessEnv => {
    const environment = { ...process.env };
    delete environment.G_DEBUG;

    return environment;
};

const observedMessage = (output: string): string | undefined =>
    output
        .split("\n")
        .find((line) => line.startsWith(OBSERVED_PREFIX))
        ?.slice(OBSERVED_PREFIX.length);

const runErrorChannel = (provocation: Provocation, observation: Observation): Promise<ErrorChannelRun> => {
    const child = spawnWithParentDeathSignal(process.execPath, [...FIXTURE_ARGS, provocation, observation], {
        env: withoutFatalCriticals(),
        stdio: ["ignore", "pipe", "pipe"],
    });

    const read = collectOutput(child);

    return new Promise((resolve) => {
        child.once("close", (code, signal) => {
            const output = read();
            resolve({ exitCode: code ?? exitCodeForSignal(signal), observed: observedMessage(output), output });
        });
    });
};

export { runErrorChannel };
