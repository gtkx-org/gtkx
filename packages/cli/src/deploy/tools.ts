import { tryResolveExecutable, warn } from "@gtkx/utils";
import { spawnSync } from "node:child_process";
import type { DeployTool } from "./types.js";
import { detectPackageFamily, installHints } from "./install-hints.js";

type ToolReport = {
    missingRequired: DeployTool[];
    missingOptional: DeployTool[];
};

const DETAIL_COLUMN = 26;
const FLATPAK_BUILDER_REF = "org.flatpak.Builder";
const FLATPAK_NODE_GENERATOR_COMMAND = "flatpak-node-generator";
const GENERATOR_PNPM_OPTION = "--pnpm-store-version";

const APPSTREAMCLI: DeployTool = {
    command: "appstreamcli",
    purpose: "validates the AppStream metainfo",
    isOptional: false,
};

const DESKTOP_FILE_VALIDATE: DeployTool = {
    command: "desktop-file-validate",
    purpose: "validates the desktop entry",
    isOptional: false,
};

const FILE_TOOL: DeployTool = {
    command: "file",
    purpose: "required by appimagetool to inspect the payload",
    isOptional: false,
};

const FLATPAK: DeployTool = {
    command: "flatpak",
    purpose: "installs the runtime and writes the bundle",
    isOptional: false,
};

const FLATPAK_BUILDER: DeployTool = {
    command: "flatpak-builder",
    purpose: "builds the Flatpak",
    isOptional: false,
    isPresent: () =>
        tryResolveExecutable("flatpak-builder") !== undefined || isFlatpakRefInstalled(FLATPAK_BUILDER_REF),
};

const FLATPAK_NODE_GENERATOR: DeployTool = {
    command: FLATPAK_NODE_GENERATOR_COMMAND,
    purpose: "vendors the dependencies a Flathub build installs offline",
    isOptional: false,
};

const FLATPAK_NODE_GENERATOR_PNPM: DeployTool = {
    ...FLATPAK_NODE_GENERATOR,
    isPresent: () => hasGeneratorPnpmSupport(),
};

const MSGFMT: DeployTool = {
    command: "msgfmt",
    purpose: "compiles the gettext catalogs and localized metadata",
    isOptional: false,
};

const MSGGREP: DeployTool = {
    command: "msggrep",
    purpose: "retains generated metadata while refreshing the catalog template",
    isOptional: false,
};

const MSGINIT: DeployTool = {
    command: "msginit",
    purpose: "initializes newly listed gettext catalogs",
    isOptional: false,
};

const MSGMERGE: DeployTool = {
    command: "msgmerge",
    purpose: "synchronizes translations with the catalog template",
    isOptional: false,
};

const XGETTEXT: DeployTool = {
    command: "xgettext",
    purpose: "extracts the gettext catalog template",
    isOptional: false,
};

const STRIP: DeployTool = {
    command: "strip",
    purpose: "would shrink the bundled Node.js by removing its symbols",
    isOptional: true,
};

const TAR: DeployTool = {
    command: "tar",
    purpose: "unpacks the downloaded Node.js and packaging tools",
    isOptional: false,
};

const isFlatpakRefInstalled = (ref: string): boolean => {
    const flatpak = tryResolveExecutable(FLATPAK.command);

    if (flatpak === undefined) {
        return false;
    }

    return spawnSync(flatpak, ["info", ref], { stdio: "ignore" }).status === 0;
};

const hasGeneratorPnpmSupport = (): boolean => {
    const generator = tryResolveExecutable(FLATPAK_NODE_GENERATOR_COMMAND);

    if (generator === undefined) {
        return false;
    }

    const help = spawnSync(generator, ["--help"], { encoding: "utf8" });

    return help.error === undefined && help.output.join("").includes(GENERATOR_PNPM_OPTION);
};

const isToolPresent = (tool: DeployTool): boolean =>
    tool.isPresent === undefined ? tryResolveExecutable(tool.command) !== undefined : tool.isPresent();

const uniqueTools = (tools: DeployTool[]): DeployTool[] =>
    new Map(tools.map((tool) => [tool.command, tool])).values().toArray();

const probeTools = (tools: DeployTool[]): ToolReport => {
    const missing = uniqueTools(tools).filter((tool) => !isToolPresent(tool));

    return {
        missingRequired: missing.filter((tool) => !tool.isOptional),
        missingOptional: missing.filter((tool) => tool.isOptional),
    };
};

const pad = (text: string): string => text.padEnd(DETAIL_COLUMN);

const toolLines = (tool: DeployTool, hints: string[]): string[] => [
    `  ${pad(tool.command)}${tool.purpose}`,
    ...hints.map((hint) => `  ${pad("")}${hint}`),
];

const missingToolsMessage = (report: ToolReport): string => {
    const family = detectPackageFamily();
    const required = report.missingRequired.flatMap((tool) => toolLines(tool, installHints(tool.command, family)));
    const count = report.missingRequired.length;
    const plural = count === 1 ? "tool is" : "tools are";

    return [
        `Cannot deploy: ${String(count)} required ${plural} missing.`,
        "",
        ...required,
        "",
        "Narrow the run with --target if you do not need every package format.",
    ].join("\n");
};

const assertTools = (report: ToolReport): void => {
    if (report.missingRequired.length > 0) {
        throw new Error(missingToolsMessage(report));
    }
};

const warnMissingOptional = (report: ToolReport): void => {
    for (const tool of report.missingOptional) {
        warn(`${tool.command} is not installed: it ${tool.purpose}`);
    }
};

export {
    APPSTREAMCLI,
    FLATPAK_NODE_GENERATOR,
    FLATPAK_NODE_GENERATOR_PNPM,
    GENERATOR_PNPM_OPTION,
    assertTools,
    DESKTOP_FILE_VALIDATE,
    FILE_TOOL,
    FLATPAK,
    FLATPAK_BUILDER,
    MSGFMT,
    MSGGREP,
    MSGINIT,
    MSGMERGE,
    probeTools,
    STRIP,
    TAR,
    warnMissingOptional,
    XGETTEXT,
};
