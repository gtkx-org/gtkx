import { compileCatalogs, resolveCatalogProject } from "../i18n/catalogs.js";
import { createRetainedStagingDir } from "../internal/staging-dir.js";

const LOCALE_DIR_ENV = "GTKX_LOCALE_DIR";
const localeDir = createRetainedStagingDir("locale");

const prepareDevLocaleDir = (root: string, domain: string): string | null => {
    const project = resolveCatalogProject(root, domain);

    if (project === null) {
        return null;
    }

    const outputDir = localeDir.retain();
    compileCatalogs(project, outputDir);
    process.env[LOCALE_DIR_ENV] = outputDir;

    return outputDir;
};

export { prepareDevLocaleDir };
