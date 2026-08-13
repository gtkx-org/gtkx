import type { DeployConfig, DeployFileAssociation } from "../types.js";

const SCHEME_HANDLER_PREFIX = "x-scheme-handler/";

const resolveFileAssociations = (deploy: DeployConfig): DeployFileAssociation[] =>
    (deploy.fileAssociations ?? []).map((entry) => ({
        extension: entry.extension,
        mimeType: entry.mimeType,
        description: entry.description ?? null,
    }));

const resolveMimeTypes = (deploy: DeployConfig): string[] => {
    const fromAssociations = (deploy.fileAssociations ?? []).map((entry) => entry.mimeType);
    const fromProtocols = (deploy.protocols ?? []).map((scheme) => `${SCHEME_HANDLER_PREFIX}${scheme}`);

    return [...new Set([...(deploy.mimeTypes ?? []), ...fromAssociations, ...fromProtocols])];
};

const resolveExecToken = (deploy: DeployConfig): string | null => {
    const mimeTypes = resolveMimeTypes(deploy);

    if (mimeTypes.length === 0) {
        return null;
    }

    return mimeTypes.some((mimeType) => mimeType.startsWith(SCHEME_HANDLER_PREFIX)) ? "%U" : "%F";
};

export { resolveExecToken, resolveFileAssociations, resolveMimeTypes };
