import { existsSync, mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CatalogProject, compileCatalogs, resolveCatalogProject, synchronizeCatalogs } from "../i18n/catalogs.js";
import { extractSourceCatalog } from "../i18n/source-messages.js";
import { discoverSourceFiles } from "../internal/source-imports.js";
import { createRetainedStagingDir } from "../internal/staging-dir.js";

const prepareCatalogs = async (project: CatalogProject, outputDir: string): Promise<void> => {
    if (!existsSync(project.template)) {
        const srcDir = join(project.root, "src");
        await extractSourceCatalog(project, discoverSourceFiles(existsSync(srcDir) ? srcDir : project.root));
    }

    synchronizeCatalogs(project);
    compileCatalogs(project, outputDir);
};

const prepareDevLocaleDir = async (root: string, domain: string): Promise<string | null> => {
    const project = resolveCatalogProject(root, domain);

    if (project === null) {
        return null;
    }

    const outputDir = createRetainedStagingDir("locale").retain();
    await prepareCatalogs(project, outputDir);

    return outputDir;
};

const checkDevCatalogs = async (root: string, domain: string): Promise<void> => {
    const project = resolveCatalogProject(root, domain);

    if (project === null) {
        return;
    }

    using outputDir = mkdtempDisposableSync(join(tmpdir(), "gtkx-locale-"));
    await prepareCatalogs(project, outputDir.path);
};

export { checkDevCatalogs, prepareDevLocaleDir };
