import type { DeploySettings } from "../types.js";

const BUNDLE_FILENAME = "bundle.js";
const NODE_FILENAME = "node";

const compileCacheLines = (binaryName: string): string[] => [
    "cache_home=${XDG_CACHE_HOME:-${HOME:-/tmp}/.cache}",
    `NODE_COMPILE_CACHE="$cache_home/${binaryName}/node"`,
    "export NODE_COMPILE_CACHE",
];

const renderLauncher = (settings: DeploySettings): string => {
    const libDir = `$prefix/lib/${settings.binaryName}`;
    const shouldUseCompileCache = settings.deploy.node?.shouldUseCompileCache !== false;

    return [
        "#!/bin/sh",
        "set -e",
        'self=$(readlink -f "$0")',
        'prefix=$(dirname "$(dirname "$self")")',
        ...(shouldUseCompileCache ? compileCacheLines(settings.binaryName) : []),
        `exec "${libDir}/${NODE_FILENAME}" "${libDir}/${BUNDLE_FILENAME}" "$@"`,
        "",
    ].join("\n");
};

export { BUNDLE_FILENAME, NODE_FILENAME, renderLauncher };
