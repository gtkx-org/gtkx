import { loadConfig } from "@gtkx/config";
import { info, warn } from "@gtkx/utils";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type {
    DeployArtifact,
    DeployManifest,
    DeployPayload,
    DeploySettings,
    DeployTarget,
    DeployTool,
} from "./types.js";
import { build as buildApp } from "../builder.js";
import { ensureGenerated } from "../codegen/run-codegen.js";
import { PACKAGED_LIBRARIES } from "./depends.js";
import { renderDesktopEntry } from "./freedesktop/desktop-entry.js";
import { renderMetainfo } from "./freedesktop/metainfo.js";
import { renderMimePackage } from "./freedesktop/mime-package.js";
import { validateDesktopEntry, validateMetainfo } from "./freedesktop/validate.js";
import { resolveNodeRuntime } from "./node-runtime/index.js";
import { collectNotices } from "./notices/collect.js";
import { type StagedMetadata, stageOverlays, stagePayload } from "./payload/stage.js";
import { DEFAULT_TARGETS, parseTargetList, targetsFor } from "./registry.js";
import { resolveDeploySettings } from "./settings/index.js";
import { readPackageManifest } from "./settings/package-manifest.js";
import { missingDeployError } from "./settings/starter.js";
import { finishArgsFor, hasDisplaySocket, runtimeLabelFor } from "./targets/flatpak-manifest.js";
import { detectPackageManager } from "./targets/flatpak-sources.js";
import {
    APPSTREAMCLI,
    assertTools,
    DESKTOP_FILE_VALIDATE,
    FLATPAK_NODE_GENERATOR,
    FLATPAK_NODE_GENERATOR_PNPM,
    probeTools,
    STRIP,
    TAR,
    warnMissingOptional,
} from "./tools.js";

type DeployOptions = {
    entry: string;
    cwd: string;
    targets?: string | undefined;
    outDir?: string | undefined;
    shouldPrintManifests: boolean;
    shouldSkipBuild: boolean;
};

const BUILD_MODE = "production";
const BYTES_PER_MIB = 1024 * 1024;
const WEBKIT_LIBRARY = "WebKit-6.0";
const NETWORK_ARG = "--share=network";
const APPIMAGE_TARGET = "appimage";
const FLATPAK_TARGET = "flatpak";

const displayPath = (settings: DeploySettings, path: string): string => relative(settings.paths.root, path);
const megabytes = (size: number): string => (size / BYTES_PER_MIB).toFixed(1);

const writeManifest = (manifest: DeployManifest): void => {
    mkdirSync(dirname(manifest.path), { recursive: true });
    writeFileSync(manifest.path, manifest.contents);
};

const renderMetadata = (settings: DeploySettings): StagedMetadata => ({
    desktopEntry: renderDesktopEntry(settings),
    metainfo: renderMetainfo(settings),
    mimePackage: renderMimePackage(settings),
});

const isFlathubSubmission = (settings: DeploySettings, targets: DeployTarget[]): boolean =>
    settings.deploy.flatpak?.mode === "source" && targets.some((target) => target.name === FLATPAK_TARGET);

const validateMetadata = (settings: DeploySettings, metadata: StagedMetadata, areWarningsFatal: boolean): void => {
    const dir = settings.paths.metadata;
    mkdirSync(dir, { recursive: true });
    const desktopPath = join(dir, `${settings.applicationId}.desktop`);
    const metainfoPath = join(dir, `${settings.applicationId}.metainfo.xml`);
    writeFileSync(desktopPath, metadata.desktopEntry);
    writeFileSync(metainfoPath, metadata.metainfo);
    validateDesktopEntry(desktopPath);
    validateMetainfo(metainfoPath, areWarningsFatal);
    info("Validated the desktop entry and the metainfo");
};

const warnMissingDisplay = (settings: DeploySettings, finishArgs: string[]): void => {
    if (hasDisplaySocket(finishArgs)) {
        return;
    }

    warn(
        `The flatpak permissions grant no display socket, so ${settings.name} will start without a window. ` +
        "Grant one through `deploy.flatpak.finishArgs`, such as `--socket=wayland`.",
    );
};

const warnMissingNetwork = (settings: DeploySettings, finishArgs: string[]): void => {
    if (settings.deploy.flatpak?.finishArgs === undefined || finishArgs.includes(NETWORK_ARG)) {
        return;
    }

    if (!settings.libraries.includes(WEBKIT_LIBRARY)) {
        return;
    }

    warn(`This app declares ${WEBKIT_LIBRARY} but its flatpak permissions omit ${NETWORK_ARG}, so pages will not load`);
};

const warnFlatpakPermissions = (targets: DeployTarget[], settings: DeploySettings): void => {
    if (targets.every((target) => target.name !== FLATPAK_TARGET)) {
        return;
    }

    const finishArgs = finishArgsFor(settings);
    warnMissingDisplay(settings, finishArgs);
    warnMissingNetwork(settings, finishArgs);
};

const floorSummary = (settings: DeploySettings): string =>
    settings.libraries
        .filter((library) => settings.libraryFloors[library] !== undefined)
        .map((library) => `${library} >= ${String(settings.libraryFloors[library])}`)
        .join(", ");

const warnAppImageFloors = (settings: DeploySettings, summary: string): void => {
    warn(
        `An AppImage cannot declare a dependency, so nothing stops ${settings.name} from starting on a host ` +
        `whose libraries are older than the ones its bindings were generated against (${summary}). ` +
        "Publish that requirement alongside the AppImage, or build on the oldest host you support.",
    );
};

const warnFlatpakFloors = (settings: DeploySettings, summary: string): void => {
    warn(
        `The flatpak bundles binaries built against ${summary}, but runs them on ` +
        `${runtimeLabelFor(settings)}, whose libraries are whatever that runtime ships. ` +
        'Set `deploy.flatpak.mode: "source"` to build inside the runtime instead.',
    );
};

const isExcusedFloor = (settings: DeploySettings, library: string): boolean => {
    const floors = settings.deploy.libraryFloors;

    return floors !== undefined && floors !== false && floors[library] === false;
};

const warnMissingFloors = (settings: DeploySettings): void => {
    if (settings.deploy.libraryFloors === false) {
        return;
    }

    const missing = settings.libraries.filter(
        (library) =>
            PACKAGED_LIBRARIES.includes(library) &&
            settings.libraryFloors[library] === undefined &&
            !isExcusedFloor(settings, library),
    );

    if (missing.length === 0) {
        return;
    }

    warn(
        `No release was recorded for ${missing.join(", ")}, so the packages carry no minimum version for ` +
        "those and will install on a host too old to run the app. Rebuild so codegen records the release, " +
        "or set `deploy.libraryFloors`.",
    );
};

const warnUnusedFloors = (settings: DeploySettings): void => {
    const floors = settings.deploy.libraryFloors;

    if (floors === undefined || floors === false) {
        return;
    }

    const unused = Object.keys(floors).filter((library) => !settings.libraries.includes(library));

    if (unused.length === 0) {
        return;
    }

    warn(
        `\`deploy.libraryFloors\` names ${unused.join(", ")}, which this project generates no bindings for, ` +
        "so those minimums change nothing.",
    );
};

const isPrebuiltFlatpak = (targets: DeployTarget[], settings: DeploySettings): boolean =>
    targets.some((target) => target.name === FLATPAK_TARGET) && settings.deploy.flatpak?.mode !== "source";

const warnLibraryFloors = (targets: DeployTarget[], settings: DeploySettings): void => {
    const summary = floorSummary(settings);

    if (summary.length > 0 && targets.some((target) => target.name === APPIMAGE_TARGET)) {
        warnAppImageFloors(settings, summary);
    }

    if (summary.length > 0 && isPrebuiltFlatpak(targets, settings)) {
        warnFlatpakFloors(settings, summary);
    }

    warnMissingFloors(settings);
    warnUnusedFloors(settings);
};

const sourceModeTools = (targets: DeployTarget[], settings: DeploySettings): DeployTool[] => {
    const isFlatpakSource = settings.deploy.flatpak?.mode === "source";

    if (!isFlatpakSource || targets.every((target) => target.name !== FLATPAK_TARGET)) {
        return [];
    }

    return detectPackageManager(settings) === "pnpm" ? [FLATPAK_NODE_GENERATOR_PNPM] : [FLATPAK_NODE_GENERATOR];
};

const isNodeRequired = (targets: DeployTarget[], settings: DeploySettings): boolean =>
    !(settings.deploy.flatpak?.mode === "source" && targets.every((target) => target.name === FLATPAK_TARGET));

const runtimeToolsFor = (targets: DeployTarget[], settings: DeploySettings): DeployTool[] => {
    if (!isNodeRequired(targets, settings)) {
        return [];
    }

    const node = settings.deploy.node ?? {};
    const archiveTools = (node.source ?? "download") === "download" ? [TAR] : [];

    return node.shouldStrip === false ? archiveTools : [...archiveTools, STRIP];
};

const preflight = (targets: DeployTarget[], settings: DeploySettings, shouldPrintManifests: boolean): void => {
    const packagerTools = shouldPrintManifests
        ? []
        : [...runtimeToolsFor(targets, settings), ...targets.flatMap((target) => target.tools)];

    const required = [DESKTOP_FILE_VALIDATE, APPSTREAMCLI, ...sourceModeTools(targets, settings)];
    const report = probeTools([...required, ...packagerTools]);
    assertTools(report);
    warnMissingOptional(report);
    warnFlatpakPermissions(targets, settings);
    warnLibraryFloors(targets, settings);
};

const resolveTargetNames = (options: DeployOptions, settings: DeploySettings): string[] => {
    if (options.targets !== undefined) {
        return parseTargetList(options.targets);
    }

    return settings.deploy.targets ?? DEFAULT_TARGETS;
};

const loadSettings = async (options: DeployOptions): Promise<DeploySettings> => {
    const { config, root } = await loadConfig(options.cwd, { mode: BUILD_MODE });

    if (config.deploy === undefined) {
        throw missingDeployError(config.applicationId, readPackageManifest(root));
    }

    return resolveDeploySettings({ root, config, outDirOverride: options.outDir });
};

const buildPayload = async (
    options: DeployOptions,
    settings: DeploySettings,
    targets: DeployTarget[],
): Promise<DeployPayload> => {
    const metadata = renderMetadata(settings);
    validateMetadata(settings, metadata, isFlathubSubmission(settings, targets));

    if (!options.shouldSkipBuild) {
        info(`Building ${options.entry}`);
        await buildApp({ entry: options.entry, vite: { root: options.cwd } });
    }

    const node = options.shouldPrintManifests || !isNodeRequired(targets, settings)
        ? null
        : await resolveNodeRuntime(settings);

    const stage = stagePayload({ settings, node, metadata });
    info(`Staged ${String(stage.length)} files into ${displayPath(settings, settings.paths.stage)}`);
    const notices = collectNotices({ settings, node });

    return { settings, node, stage, notices, overlays: stageOverlays(settings, notices) };
};

const renderTargetManifests = (
    targets: DeployTarget[],
    payload: DeployPayload,
): Map<DeployTarget, DeployManifest[]> => {
    const rendered: Map<DeployTarget, DeployManifest[]> = new Map();

    for (const target of targets) {
        const manifests = target.render(payload);

        for (const manifest of manifests) {
            writeManifest(manifest);
            info(`Wrote ${displayPath(payload.settings, manifest.path)}`);
        }

        rendered.set(target, manifests);
    }

    return rendered;
};

const packTargets = async (
    rendered: Map<DeployTarget, DeployManifest[]>,
    payload: DeployPayload,
): Promise<DeployArtifact[]> => {
    const artifacts: DeployArtifact[] = [];

    for (const [target, manifests] of rendered) {
        const built = await target.pack(payload, manifests);

        for (const artifact of built) {
            info(`Built ${displayPath(payload.settings, artifact.path)} (${megabytes(artifact.size)} MiB)`);
        }

        artifacts.push(...built);
    }

    return artifacts;
};

const announce = (settings: DeploySettings, targets: DeployTarget[]): void => {
    const names = targets.map((target) => target.name).join(", ");
    const version = `${settings.versions.packageVersion}-${settings.versions.debRevision}`;
    info(`Deploying ${settings.name} ${version} as ${settings.binaryName} (${settings.arch.rpm}) to ${names}`);
};

const runDeploy = async (options: DeployOptions): Promise<void> => {
    if (!options.shouldSkipBuild) {
        await ensureGenerated(options.cwd, { shouldAnnounce: true, mode: BUILD_MODE });
    }

    const settings = await loadSettings(options);
    const targets = targetsFor(resolveTargetNames(options, settings));
    announce(settings, targets);
    preflight(targets, settings, options.shouldPrintManifests);
    const payload = await buildPayload(options, settings, targets);
    const rendered = renderTargetManifests(targets, payload);

    if (options.shouldPrintManifests) {
        const count = rendered.values().toArray().flat().length;
        info(`Wrote ${String(count)} manifests, 0 packages built`);

        return;
    }

    const artifacts = await packTargets(rendered, payload);
    const output = displayPath(settings, settings.paths.output);
    info(`Deploy complete: ${String(artifacts.length)} artifacts in ${output}`);
};

export { runDeploy };
