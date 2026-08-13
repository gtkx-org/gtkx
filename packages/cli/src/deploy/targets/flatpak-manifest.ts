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

const branchFor = (settings: DeploySettings): string => settings.deploy.flatpak?.branch ?? DEFAULT_BRANCH;
const isSourceMode = (settings: DeploySettings): boolean => settings.deploy.flatpak?.mode === "source";

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
    const flatpak = settings.deploy.flatpak ?? {};

    return {
        id: settings.applicationId,
        ...runtimeKeys(settings),
        command: settings.binaryName,
        "finish-args": flatpak.finishArgs ?? DEFAULT_FINISH_ARGS,
        cleanup: flatpak.cleanup ?? DEFAULT_CLEANUP,
        modules: modulesFor(payload),
    };
};

export { branchFor, renderFlatpakManifest };
