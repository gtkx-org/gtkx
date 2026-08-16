import type { DeployPayload, DeploySettings } from "../types.js";
import { optional } from "../nfpm/optional.js";
import { flatpakPrebuiltModule } from "./flatpak-prebuilt.js";
import { flatpakSourceModule } from "./flatpak-source.js";
import { nodeExtensionFor } from "./flatpak-sources.js";

type FlatpakManifest = Record<string, unknown>;

const DEFAULT_BRANCH = "stable";
const DEFAULT_RUNTIME = "org.gnome.Platform";
const DEFAULT_RUNTIME_VERSION = "50";
const DEFAULT_SDK = "org.gnome.Sdk";
const DEFAULT_FINISH_ARGS = ["--share=ipc", "--socket=wayland", "--socket=fallback-x11", "--device=dri"];
const DEFAULT_CLEANUP = ["/include", "/share/pkgconfig", "*.la", "*.a"];
const DISPLAY_SOCKETS = ["fallback-x11", "wayland", "x11"];
const SOCKET_ARG = "--socket=";
const NO_SOCKET_ARG = "--nosocket=";

const NEGATED_ARGS: [string, string][] = [
    ["--device=", "--nodevice="],
    ["--share=", "--unshare="],
    [SOCKET_ARG, NO_SOCKET_ARG],
];

const branchFor = (settings: DeploySettings): string => settings.deploy.flatpak?.branch ?? DEFAULT_BRANCH;
const isSourceMode = (settings: DeploySettings): boolean => settings.deploy.flatpak?.mode === "source";

const negationFor = (arg: string): string | null => {
    const negated = NEGATED_ARGS.find(([prefix]) => arg.startsWith(prefix));

    if (negated === undefined) {
        return null;
    }

    const [prefix, negation] = negated;

    return `${negation}${arg.slice(prefix.length)}`;
};

const mergeArgs = (defaults: string[], overrides: string[]): string[] => {
    const kept = defaults.filter((arg) => {
        const negation = negationFor(arg);

        return negation === null || !overrides.includes(negation);
    });

    return [...new Set([...kept, ...overrides])];
};

const finishArgsFor = (settings: DeploySettings): string[] =>
    mergeArgs(DEFAULT_FINISH_ARGS, settings.deploy.flatpak?.finishArgs ?? []);

const cleanupFor = (settings: DeploySettings): string[] => {
    const cleanup = settings.deploy.flatpak?.cleanup;

    if (cleanup === undefined) {
        return DEFAULT_CLEANUP;
    }

    return cleanup.length === 0 ? [] : mergeArgs(DEFAULT_CLEANUP, cleanup);
};

const grantedSockets = (args: string[]): Set<string> => {
    const granted: Set<string> = new Set();

    for (const arg of args) {
        if (arg.startsWith(SOCKET_ARG)) {
            granted.add(arg.slice(SOCKET_ARG.length));
        }

        if (arg.startsWith(NO_SOCKET_ARG)) {
            granted.delete(arg.slice(NO_SOCKET_ARG.length));
        }
    }

    return granted;
};

const hasDisplaySocket = (args: string[]): boolean => {
    const granted = grantedSockets(args);

    return DISPLAY_SOCKETS.some((socket) => granted.has(socket));
};

const sdkExtensionsFor = (settings: DeploySettings): string[] => {
    const flatpak = settings.deploy.flatpak ?? {};
    const nodeExtension = isSourceMode(settings) ? [nodeExtensionFor(settings)] : [];

    return [...nodeExtension, ...(flatpak.sdkExtensions ?? [])];
};

const modulesFor = (payload: DeployPayload): unknown[] => {
    const settings = payload.settings;
    const own = isSourceMode(settings) ? flatpakSourceModule(payload) : flatpakPrebuiltModule(payload);

    return [...(settings.deploy.flatpak?.modules ?? []), own];
};

const runtimeKeys = (settings: DeploySettings): FlatpakManifest => {
    const flatpak = settings.deploy.flatpak ?? {};
    const extensions = sdkExtensionsFor(settings);

    return {
        runtime: flatpak.runtime ?? DEFAULT_RUNTIME,
        "runtime-version": flatpak.runtimeVersion ?? DEFAULT_RUNTIME_VERSION,
        sdk: flatpak.sdk ?? DEFAULT_SDK,
        ...optional("base", flatpak.base),
        ...optional("base-version", flatpak.baseVersion),
        ...optional("sdk-extensions", extensions.length === 0 ? undefined : extensions),
    };
};

const renderFlatpakManifest = (payload: DeployPayload): FlatpakManifest => {
    const settings = payload.settings;

    return {
        id: settings.applicationId,
        ...runtimeKeys(settings),
        command: settings.binaryName,
        "finish-args": finishArgsFor(settings),
        cleanup: cleanupFor(settings),
        modules: modulesFor(payload),
    };
};

export { branchFor, finishArgsFor, hasDisplaySocket, renderFlatpakManifest };
