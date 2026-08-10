import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DeployArtifact, DeployPayload } from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { resolveNfpm } from "../vendored/nfpm.js";
import { type NfpmPackager, packageNameFor } from "./config.js";

const artifactNameFor = (payload: DeployPayload, packager: NfpmPackager): string => {
    const { settings } = payload;
    const name = packageNameFor(settings, packager);
    const { packageVersion, debRevision, rpmRelease } = settings.versions;

    if (packager === "deb") {
        return `${name}_${packageVersion}-${debRevision}_${settings.arch.deb}.deb`;
    }

    return `${name}-${packageVersion}-${rpmRelease}.${settings.arch.rpm}.rpm`;
};

const packWithNfpm = async (
    payload: DeployPayload,
    packager: NfpmPackager,
    configPath: string,
): Promise<DeployArtifact> => {
    const nfpm = await resolveNfpm();
    const output = payload.settings.paths.output;
    mkdirSync(output, { recursive: true });
    const target = join(output, artifactNameFor(payload, packager));

    runCliTool({
        tool: nfpm,
        args: ["package", "--config", configPath, "--packager", packager, "--target", target],
        target: `the ${packager} package`,
        shouldStream: true,
    });

    if (!existsSync(target)) {
        throw new Error(`nfpm reported success but wrote no ${packager} package at ${target}`);
    }

    return { path: target, size: statSync(target).size };
};

export { packWithNfpm };
