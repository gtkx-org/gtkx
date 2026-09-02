import type { DeploySettings } from "../types.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";

const NODE_FILENAME = "node";
const SHELL_SINGLE_QUOTE = "'";
const SHELL_SINGLE_QUOTE_ESCAPE = "'\"'\"'";

const compileCacheLines = (binaryName: string): string[] => [
    "cache_home=${XDG_CACHE_HOME:-${HOME:-/tmp}/.cache}",
    `NODE_COMPILE_CACHE="$cache_home/${binaryName}/node"`,
    "export NODE_COMPILE_CACHE",
];

const shellQuote = (value: string): string =>
    SHELL_SINGLE_QUOTE + value.split(SHELL_SINGLE_QUOTE).join(SHELL_SINGLE_QUOTE_ESCAPE) + SHELL_SINGLE_QUOTE;

const launcherEnvLines = (settings: DeploySettings): string[] =>
    Object.entries(settings.deploy.launcherEnv ?? {})
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => `export ${name}=${shellQuote(value)}`);

const launcherCommand = (settings: DeploySettings, libDir: string): string =>
    [
        `"${libDir}/${NODE_FILENAME}"`,
        ...(settings.deploy.nodeFlags ?? []).map((flag) => shellQuote(flag)),
        `"${libDir}/${BUNDLE_FILENAME}"`,
        '"$@"',
    ].join(" ");

const renderLauncher = (settings: DeploySettings): string => {
    const libDir = `$prefix/lib/${settings.binaryName}`;
    const shouldUseCompileCache = settings.deploy.node?.shouldUseCompileCache !== false;

    return [
        "#!/bin/sh",
        "set -e",
        'self=$(readlink -f "$0")',
        'prefix=$(dirname "$(dirname "$self")")',
        'GTKX_LOCALE_DIR="$prefix/share/locale"',
        "export GTKX_LOCALE_DIR",
        ...(shouldUseCompileCache ? compileCacheLines(settings.binaryName) : []),
        ...launcherEnvLines(settings),
        `exec ${launcherCommand(settings, libDir)}`,
        "",
    ].join("\n");
};

export { NODE_FILENAME, renderLauncher };
