import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [command, ...args] = process.argv.slice(2);

if (!command) {
    throw new Error("Expected a task command");
}

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const shellCommand = [command, ...args.map(quote)].join(" ");
const container = process.env.GTKX_CI_CONTAINER;
const workspaceRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const pidFile = `/tmp/gtkx-ci-task-${randomUUID()}.pid`;
const forwardedVariables = [
    "CI",
    "NODE_OPTIONS",
    "FORCE_COLOR",
    "NO_COLOR",
    "TERM",
    "GTKX_GIR_PATH",
    "GTKX_RELEASE_NATIVE_ARTIFACTS",
    "GI_TYPELIB_PATH",
    "LD_LIBRARY_PATH",
    "PKG_CONFIG_PATH",
    "PKG_CONFIG_LIBDIR",
    "PKG_CONFIG_SYSROOT_DIR",
    "RUSTUP_TOOLCHAIN",
    "RUSTFLAGS",
    "RUST_BACKTRACE",
    "CARGO_ENCODED_RUSTFLAGS",
    "CARGO_BUILD_TARGET",
    "CARGO_BUILD_JOBS",
    "SHELLCHECK_OPTS",
    "NX_WORKSPACE_ROOT",
    "NX_TASK_TARGET_PROJECT",
    "NX_TASK_TARGET_TARGET",
    "NX_TASK_TARGET_CONFIGURATION",
    "NX_CACHE_DIRECTORY",
    "NX_SKIP_NX_CACHE",
    "NX_DAEMON",
    "NX_INTERACTIVE",
    "NX_PLUGIN_NO_TIMEOUT",
    "NX_ISOLATE_PLUGINS",
];

const containerCommand = [
    "exec",
    "--workdir",
    process.cwd(),
    ...forwardedVariables.filter((name) => process.env[name] !== undefined).flatMap((name) => ["--env", name]),
    container,
    "setsid",
    "--wait",
    "sh",
    "-c",
    'pidFile=$1; shift; printf "%s\\n" "$$" > "$pidFile"; trap \'rm -f "$pidFile"\' EXIT; ' +
        'export PATH="$1:$2:$PATH"; shift 2; "$@"',
    "gtkx-ci-task",
    pidFile,
    join(process.cwd(), "node_modules/.bin"),
    join(workspaceRoot, "node_modules/.bin"),
    "sh",
    "-c",
    shellCommand,
];

const child = container
    ? spawn("docker", containerCommand, { stdio: "inherit" })
    : spawn(shellCommand, { shell: true, stdio: "inherit", detached: true });

let terminatingSignal;

const terminate = (signal) => {
    if (terminatingSignal) {
        return;
    }

    terminatingSignal = signal;

    if (container) {
        spawnSync(
            "docker",
            [
                "exec",
                container,
                "sh",
                "-c",
                'if [ -f "$1" ]; then pid=$(cat "$1"); case "$pid" in ""|*[!0-9]*) exit 1;; esac; ' +
                    '/bin/kill -s "$2" -- "-$pid"; fi',
                "gtkx-ci-stop",
                pidFile,
                signal,
            ],
            { stdio: "ignore", timeout: 5_000 },
        );
        child.kill(signal);
    } else if (child.pid !== undefined) {
        try {
            process.kill(-child.pid, signal);
        } catch (error) {
            if (error.code !== "ESRCH") {
                throw error;
            }
        }
    }
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => terminate(signal));
}

child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
});

child.on("exit", (code, signal) => {
    const receivedSignal = terminatingSignal ?? signal;

    if (receivedSignal) {
        process.removeAllListeners(receivedSignal);
        process.kill(process.pid, receivedSignal);
    } else {
        process.exitCode = code ?? 1;
    }
});
