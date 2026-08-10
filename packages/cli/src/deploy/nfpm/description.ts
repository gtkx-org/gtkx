import type { DeploySettings } from "../types.js";

const DEBIAN_PARAGRAPH_SEPARATOR = ".";

const debDescription = (settings: DeploySettings): string =>
    [settings.summary, ...settings.description.flatMap((paragraph, index) =>
        index === 0 ? [paragraph] : [DEBIAN_PARAGRAPH_SEPARATOR, paragraph])].join("\n");

const rpmDescription = (settings: DeploySettings): string => settings.description.join("\n\n");

export { debDescription, rpmDescription };
