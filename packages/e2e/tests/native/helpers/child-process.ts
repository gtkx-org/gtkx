import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const FIXTURE_ARGS = ["--conditions=source", "--import", "tsx"];
const FIXTURE_TIMEOUT = 30_000;

type FixtureRun = {
    code: number | null;
    output: string;
    signal: NodeJS.Signals | null;
};

type FixtureOptions = {
    args?: string[];
    env?: NodeJS.ProcessEnv;
    nodeArgs?: string[];
    timeout?: number;
};

const fixturePath = (name: string): string =>
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const fixtureArgs = (name: string, nodeArgs: string[] = []): string[] => [
    ...FIXTURE_ARGS,
    ...nodeArgs,
    fixturePath(name),
];

const childEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
    const environment: NodeJS.ProcessEnv = { ...process.env, ...overrides };

    if (environment.LSAN_OPTIONS !== undefined) {
        environment.LSAN_OPTIONS = `${environment.LSAN_OPTIONS}:leak_check_at_exit=0`;
    }

    return environment;
};

const runFixture = (
    name: string,
    { args = [], env = childEnv(), nodeArgs = [], timeout = FIXTURE_TIMEOUT }: FixtureOptions = {},
): Promise<FixtureRun> =>
    new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [...fixtureArgs(name, nodeArgs), ...args], {
            env,
            killSignal: "SIGKILL",
            stdio: ["ignore", "pipe", "pipe"],
            timeout,
        });
        const chunks: Buffer[] = [];

        child.stdout.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });
        child.once("error", reject);
        child.once("close", (code, signal) => {
            resolve({ code, output: Buffer.concat(chunks).toString("utf8"), signal });
        });
    });

export { childEnv, fixtureArgs, runFixture };
