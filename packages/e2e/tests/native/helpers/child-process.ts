import { fileURLToPath } from "node:url";

const FIXTURE_ARGS = ["--conditions=source", "--import", "tsx"];

const fixturePath = (name: string): string =>
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/**
 * Arguments that run a fixture as a child process, compiled the way the rest of the workspace
 * runs TypeScript entry points.
 */
const fixtureArgs = (name: string, nodeArgs: string[] = []): string[] => [
    ...FIXTURE_ARGS,
    ...nodeArgs,
    fixturePath(name),
];

/**
 * The environment a fixture child runs in. The sanitizer checks leaks per test in the parent, so
 * a child must not also check at exit: its own exit code is what several tests assert on.
 */
const childEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
    const environment: NodeJS.ProcessEnv = { ...process.env, ...overrides };

    if (environment.LSAN_OPTIONS !== undefined) {
        environment.LSAN_OPTIONS = `${environment.LSAN_OPTIONS}:leak_check_at_exit=0`;
    }

    return environment;
};

export { childEnv, fixtureArgs };
