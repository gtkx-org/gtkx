import { info } from "@gtkx/utils";
import { join } from "node:path";
import { stringify } from "yaml";
import type { DeployArtifact, DeployManifest, DeployPayload, DeployTarget } from "../types.js";
import { glibcMinimumForPackage, type NfpmPackager, renderNfpmConfig } from "../nfpm/config.js";
import { packWithNfpm } from "../nfpm/pack.js";
import { TAR } from "../tools.js";

const MANIFEST_FILENAME = "nfpm.yaml";
const PREFIX = "/usr";

const manifestPathFor = (payload: DeployPayload, packager: NfpmPackager): string =>
    join(payload.settings.paths.targets, packager, MANIFEST_FILENAME);

const renderManifests = (payload: DeployPayload, packager: NfpmPackager): DeployManifest[] => {
    const glibcMinimum = glibcMinimumForPackage(payload, packager);

    if (glibcMinimum !== null) {
        info(`${packager} package requires glibc >= ${glibcMinimum}`);
    }

    return [{
        path: manifestPathFor(payload, packager),
        contents: stringify(renderNfpmConfig(payload, packager, glibcMinimum), { lineWidth: 0 }),
    }];
};

const packPackage = async (payload: DeployPayload, packager: NfpmPackager): Promise<DeployArtifact[]> => [
    await packWithNfpm(payload, packager, manifestPathFor(payload, packager)),
];

const nfpmTarget = (packager: NfpmPackager): DeployTarget => ({
    name: packager,
    prefix: PREFIX,
    tools: [TAR],
    render: (payload) => renderManifests(payload, packager),
    pack: (payload) => packPackage(payload, packager),
});

export { nfpmTarget };
