import { resolveExecutable } from "@gtkx/utils";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { loadHeadlessDisplay } from "./e2e-registry.js";

type WindowNode = {
    id: number;
    nodes: WindowNode[];
} & Record<"app_id", string | null> & Record<"floating_nodes", WindowNode[]>;

type SavedTasks = { state: { tasks: { id: string; done: boolean; completedAt: string | null }[] } };
type Installation = { directory: string; serviceDirectory: string; stateFile: string };

const call = promisify(execFile);
const busctl = resolveExecutable("busctl");
const swaymsg = resolveExecutable("swaymsg");
const daemonArgs = ["org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus"];

function prepareInstallation(prefix: string, applicationId: string, binaryName: string): Installation {
    const directory = join(prefix, "activation-check");
    const dataHome = join(directory, "data");
    const serviceDirectory = join(dataHome, "dbus-1", "services");
    const stateFile = join(dataHome, applicationId, "tasks.json");
    const createdAt = new Date().toISOString();
    const tasks = ["first", "second"].map((id, position) => ({
        id, position, listId: "activation", title: `Activation ${id}`, notes: "", done: false,
        important: false, deleted: false, due: null, createdAt, completedAt: null, lastNotifiedDue: null,
    }));

    mkdirSync(serviceDirectory, { recursive: true });
    mkdirSync(join(dataHome, applicationId), { recursive: true });
    writeFileSync(stateFile, JSON.stringify({
        version: 1,
        state: { lists: [{ id: "activation", name: "Activation", color: "blue" }], tasks },
    }));
    const servicePath = join(prefix, "usr", "share", "dbus-1", "services", `${applicationId}.service`);
    const service = readFileSync(servicePath, "utf8");
    writeFileSync(join(serviceDirectory, `${applicationId}.service`),
        service.replace(`/usr/bin/${binaryName}`, () => join(prefix, "usr", "bin", binaryName)));
    Object.assign(process.env, {
        XDG_DATA_HOME: dataHome,
        XDG_DATA_DIRS: `${join(prefix, "usr", "share")}:/usr/local/share:/usr/share`,
        XDG_CONFIG_HOME: join(directory, "config"),
        XDG_CACHE_HOME: join(directory, "cache"),
        LANG: "C.UTF-8", LC_ALL: "C.UTF-8", LANGUAGE: "en", GTK_USE_PORTAL: "0",
    });

    return { directory, serviceDirectory, stateFile };
}

async function until(isReady: () => boolean | Promise<boolean>): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (!await isReady()) {
        assert.ok(Date.now() < deadline);
        await delay(50);
    }
}

function collectWindows(node: WindowNode, applicationId: string): WindowNode[] {
    return node.app_id === applicationId
        ? [node]
        : [...node.nodes, ...node.floating_nodes].flatMap((child) => collectWindows(child, applicationId));
}

class ApplicationSession {
    private readonly applicationId: string;
    private readonly runtime: string;
    private readonly busArgs: string[];
    private readonly windowArgs: string[];
    private applicationPid: number | undefined;

    constructor(applicationId: string, runtime: string, address: string) {
        this.applicationId = applicationId;
        this.runtime = runtime;
        this.busArgs = [`--address=${address}`, "--timeout=10", "call"];
        const socket = readdirSync(runtime).find((name) => name.startsWith("sway-ipc.") && name.endsWith(".sock"));
        assert.ok(socket !== undefined);
        this.windowArgs = ["--socket", join(runtime, socket), "-t", "get_tree", "-r"];
    }

    private async bus(...args: string[]): Promise<string> {
        const { stdout } = await call(busctl, [...this.busArgs, ...args], { timeout: 15_000 });

        return stdout.trim();
    }

    private daemon(method: string, ...args: string[]): Promise<string> {
        return this.bus(...daemonArgs, method, ...args);
    }

    private applicationCall(method: string, ...args: string[]): Promise<string> {
        const objectPath = `/${this.applicationId.replaceAll(".", "/")}`;

        return this.bus(this.applicationId, objectPath, "org.freedesktop.Application", method, ...args);
    }

    async configureActivation(serviceDirectory: string, headlessEnvironmentNames: string[]): Promise<void> {
        const configPath = join(this.runtime, "session.conf");
        writeFileSync(configPath, readFileSync(configPath, "utf8").replace(
            "</busconfig>", () => `<servicedir>${serviceDirectory}</servicedir>\n</busconfig>`,
        ));
        const environmentNames = [
            ...headlessEnvironmentNames, "PATH", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR",
            "XDG_DATA_HOME", "XDG_DATA_DIRS", "XDG_CONFIG_HOME", "XDG_CACHE_HOME",
            "LANG", "LC_ALL", "LANGUAGE", "GTK_USE_PORTAL",
        ];
        const environment = environmentNames.flatMap((name) => {
            const value = process.env[name];

            return value === undefined ? [] : [[name, value]];
        });
        await this.daemon("UpdateActivationEnvironment", "a{ss}", String(environment.length), ...environment.flat());
        await this.daemon("ReloadConfig");
    }

    async hasOwner(): Promise<boolean> {
        return await this.daemon("NameHasOwner", "s", this.applicationId) === "b true";
    }

    async ownerPid(): Promise<number> {
        const response = await this.daemon("GetConnectionUnixProcessID", "s", this.applicationId);
        this.applicationPid = Number(response.split(" ", 2)[1]);

        return this.applicationPid;
    }

    activateAction(name: string, id: string, parameterType = "s"): Promise<string> {
        return this.applicationCall("ActivateAction", "sava{sv}", name, "1", parameterType, id, "0");
    }

    activate(): Promise<string> {
        return this.applicationCall("Activate", "a{sv}", "0");
    }

    async windows(): Promise<WindowNode[]> {
        const { stdout } = await call(swaymsg, this.windowArgs, { timeout: 10_000 });
        const tree = JSON.parse(stdout) as WindowNode;

        return collectWindows(tree, this.applicationId);
    }

    async hasWindows(count: number): Promise<boolean> {
        const current = await this.windows();

        return current.length === count;
    }

    stopProcess(): void {
        if (this.applicationPid === undefined) {
            return;
        }

        try {
            process.kill(this.applicationPid, "SIGTERM");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
                throw error;
            }
        }

        this.applicationPid = undefined;
    }

    async stop(): Promise<void> {
        if (await this.hasOwner()) {
            await this.ownerPid();
        }

        this.stopProcess();
        await until(async () => !await this.hasOwner());
        await until(() => this.hasWindows(0));
    }
}

async function verifyOpening(application: ApplicationSession): Promise<void> {
    assert.equal(await application.hasOwner(), false);
    await application.activateAction("open-task", "first");
    const firstPid = await application.ownerPid();
    await until(() => application.hasWindows(1));
    const [firstWindow] = await application.windows();
    assert.ok(firstWindow !== undefined);

    await application.activateAction("open-task", "second");
    await application.activate();
    assert.equal(await application.ownerPid(), firstPid);
    const reopened = await application.windows();
    assert.deepEqual(reopened.map((window) => window.id), [firstWindow.id]);

    await assert.rejects(() => application.activateAction("open-task", "7", "i"), { code: 1 });
}

async function verifyCompletion(application: ApplicationSession, stateFile: string): Promise<void> {
    await application.activateAction("complete-task", "first");
    const completionPid = await application.ownerPid();
    await until(() => {
        const saved = JSON.parse(readFileSync(stateFile, "utf8")) as SavedTasks;

        return saved.state.tasks.some((task) => task.id === "first" && task.done && task.completedAt !== null);
    });
    assert.equal(await application.hasWindows(0), true);
    await application.activate();
    await until(() => application.hasWindows(1));
    assert.equal(await application.ownerPid(), completionPid);
}

async function verifyInstalledActions(): Promise<void> {
    const [prefix, applicationId, binaryName] = process.argv.slice(2);
    assert.ok(prefix !== undefined && applicationId !== undefined && binaryName !== undefined);
    const installation = prepareInstallation(prefix, applicationId, binaryName);
    const { startHeadlessDisplay, resolveHeadlessOptions, STATIC_HEADLESS_ENV } = await loadHeadlessDisplay();
    const teardown = await startHeadlessDisplay(resolveHeadlessOptions({}));
    let application: ApplicationSession | undefined;

    try {
        const runtime = process.env.XDG_RUNTIME_DIR;
        const address = process.env.DBUS_SESSION_BUS_ADDRESS;
        assert.ok(runtime !== undefined && address !== undefined);
        application = new ApplicationSession(applicationId, runtime, address);
        await application.configureActivation(installation.serviceDirectory, Object.keys(STATIC_HEADLESS_ENV));

        try {
            await verifyOpening(application);
            await application.stop();
            await verifyCompletion(application, installation.stateFile);
        } finally {
            await application.stop();
        }
    } finally {
        try {
            application?.stopProcess();
        } finally {
            teardown();
            rmSync(installation.directory, { recursive: true, force: true });
        }
    }

    console.log("tutorial: installed application actions pass");
}

await verifyInstalledActions();
