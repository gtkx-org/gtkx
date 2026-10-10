import { compileCatalogs, resolveCatalogProject, synchronizeCatalogs } from "../i18n/catalogs.js";
import { createRetainedStagingDir } from "../internal/staging-dir.js";

const prepareDevLocaleDir = (root: string, domain: string): string | null => {
    const project = resolveCatalogProject(root, domain);

    if (project === null) {
        return null;
    }

    const outputDir = createRetainedStagingDir("locale").retain();
    synchronizeCatalogs(project);
    compileCatalogs(project, outputDir);

    return outputDir;
};

export { prepareDevLocaleDir };
