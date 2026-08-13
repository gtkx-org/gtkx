import { errorMessage, info, tryResolveExecutable } from "@gtkx/utils";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { DeployArtifact, DeployManifest, DeployPayload, DeploySettings, DeployTarget } from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { APPSTREAMCLI, DESKTOP_FILE_VALIDATE, FLATPAK, FLATPAK_BUILDER } from "../tools.js";
import { branchFor, renderFlatpakManifest } from "./flatpak-manifest.js";
import { detectPackageManager, generateNodeSources } from "./flatpak-sources.js";

type BuilderInvocation = {
    tool: string;
    prefix: string[];
};

const PREFIX = "/app";
const TARGET_DIR = "flatpak";
const FLATHUB_REPO = "https://dl.flathub.org/repo/flathub.flatpakrepo";
const BUILDER_REF = "org.flatpak.Builder";

const flatpakTarget: DeployTarget = {
    name: "flatpak",
    prefix: PREFIX,
    tools: [FLATPAK, FLATPAK_BUILDER, DESKTOP_FILE_VALIDATE, APPSTREAMCLI],
    render: (payload) => renderManifests(payload),
    pack: (payload) => Promise.try(() => packFlatpak(payload)),
};

const flatpakDir = (settings: DeploySettings): string => join(settings.paths.targets, TARGET_DIR);

const manifestPathFor = (settings: DeploySettings): string =>
    join(flatpakDir(settings), `${settings.applicationId}.yml`);

const resolveBuilder = (): BuilderInvocation => {
    if (tryResolveExecutable(FLATPAK_BUILDER.command) !== undefined) {
        return { tool: FLATPAK_BUILDER.command, prefix: [] };
    }

    return { tool: FLATPAK.command, prefix: ["run", BUILDER_REF] };
};

const isSourceMode = (settings: DeploySettings): boolean => settings.deploy.flatpak?.mode === "source";

const renderManifests = (payload: DeployPayload): DeployManifest[] => {
    const settings = payload.settings;

    if (isSourceMode(settings)) {
        generateNodeSources(settings, detectPackageManager(settings));
    }

    return [{
        path: manifestPathFor(settings),
        contents: stringify(renderFlatpakManifest(payload), { lineWidth: 0 }),
    }];
};

const builderArgsFor = (settings: DeploySettings, dir: string): string[] => [
    "--force-clean",
    "--user",
    "--install-deps-from=flathub",
    `--default-branch=${branchFor(settings)}`,
    ...(settings.deploy.flatpak?.shouldUseRofilesFuse === false ? ["--disable-rofiles-fuse"] : []),
    `--state-dir=${join(dir, "state")}`,
    `--repo=${join(dir, "repo")}`,
    join(dir, "build"),
    manifestPathFor(settings),
];

const buildFlatpak = (settings: DeploySettings): void => {
    const dir = flatpakDir(settings);
    const builder = resolveBuilder();
    info("flatpak: running flatpak-builder, this can take several minutes");

    try {
        runCliTool({
            tool: builder.tool,
            args: [...builder.prefix, ...builderArgsFor(settings, dir)],
            target: "the flatpak",
            shouldStream: true,
        });
    } catch (error) {
        throw new Error(
            `${errorMessage(error)}\n\nIf it stopped at "Failure spawning rofiles-fuse", the build is running ` +
            "somewhere FUSE is unavailable, such as a container. Set `deploy.flatpak.shouldUseRofilesFuse: false` " +
            "to build without it.",
            { cause: error },
        );
    }
};

const bundleArgsFor = (settings: DeploySettings, target: string): string[] => {
    const signing = settings.deploy.signing?.flatpak;
    const runtimeRepo = settings.deploy.flatpak?.runtimeRepo ?? FLATHUB_REPO;

    return [
        "build-bundle",
        join(flatpakDir(settings), "repo"),
        target,
        settings.applicationId,
        branchFor(settings),
        `--arch=${settings.arch.flatpak}`,
        `--runtime-repo=${runtimeRepo}`,
        ...(signing === undefined ? [] : [`--gpg-sign=${signing.gpgKeyId}`]),
        ...(signing?.gpgHomeDir === undefined ? [] : [`--gpg-homedir=${signing.gpgHomeDir}`]),
    ];
};

const bundleFlatpak = (settings: DeploySettings): DeployArtifact => {
    const output = settings.paths.output;
    mkdirSync(output, { recursive: true });
    const version = settings.versions.packageVersion;
    const target = join(output, `${settings.applicationId}-${version}-${settings.arch.flatpak}.flatpak`);
    runCliTool({ tool: FLATPAK.command, args: bundleArgsFor(settings, target), target: "the flatpak bundle" });

    if (!existsSync(target)) {
        throw new Error(`flatpak build-bundle reported success but wrote no bundle at ${target}`);
    }

    return { path: target, size: statSync(target).size };
};

const installFlatpak = (settings: DeploySettings): void => {
    runCliTool({
        tool: FLATPAK.command,
        args: ["install", "--user", "--noninteractive", "--reinstall", join(flatpakDir(settings), "repo"),
            settings.applicationId],
        target: "the flatpak",
        shouldStream: true,
    });
};

const packFlatpak = (payload: DeployPayload): DeployArtifact[] => {
    const settings = payload.settings;
    buildFlatpak(settings);

    if (settings.deploy.flatpak?.shouldInstall === true) {
        installFlatpak(settings);
    }

    return settings.deploy.flatpak?.shouldEmitBundle === false ? [] : [bundleFlatpak(settings)];
};

export { flatpakTarget };
