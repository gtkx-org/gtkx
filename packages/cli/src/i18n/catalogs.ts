import { isPathInside } from "@gtkx/utils";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { runCliTool } from "../internal/run-cli-tool.js";

type Catalog = {
    locale: string;
    path: string;
};

type CatalogProject = {
    catalogs: Catalog[];
    domain: string;
    linguasPath: string;
    locales: string[];
    poDir: string;
    poFiles: string[];
    root: string;
};

type PreparedCatalog = {
    isChanged: boolean;
    output: string;
    target: string;
};

const PO_DIRNAME = "po";
const LOCALE_DIRNAME = "locale";
const LINGUAS_FILENAME = "LINGUAS";
const LOCALE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.@+-]*$/;
const DOMAIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MODE_MASK = 0o7777;

const parseLocales = (linguasPath: string): string[] => {
    const source = readFileSync(linguasPath, "utf8");

    const tokens = source
        .split(/\r?\n/)
        .flatMap((line) => line.replace(/#.*/, "").trim().split(/\s+/))
        .filter((token) => token.length > 0);

    const seen: Set<string> = new Set();

    for (const token of tokens) {
        if (!LOCALE_PATTERN.test(token) || seen.has(token)) {
            throw new Error(`Invalid locale in ${linguasPath}: ${token}`);
        }

        seen.add(token);
    }

    return tokens;
};

const requireFile = (path: string): void => {
    if (!existsSync(path) || !statSync(path).isFile()) {
        throw new Error(`Missing translation catalog: ${path}`);
    }
};

const requiresCatalogInitialization = (project: CatalogProject): boolean =>
    project.catalogs.some((catalog) => !existsSync(catalog.path));

const resolveCatalogProject = (root: string, domain: string): CatalogProject | null => {
    const projectRoot = resolve(root);
    const poDir = join(projectRoot, PO_DIRNAME);

    if (!existsSync(poDir)) {
        return null;
    }

    if (!statSync(poDir).isDirectory()) {
        throw new Error(`Translation source is not a directory: ${poDir}`);
    }

    if (!DOMAIN_PATTERN.test(domain)) {
        throw new Error(`Invalid translation domain: ${domain}`);
    }

    const linguasPath = join(poDir, LINGUAS_FILENAME);
    requireFile(linguasPath);
    const locales = parseLocales(linguasPath);
    const catalogs = locales.map((locale) => ({ locale, path: join(poDir, `${locale}.po`) }));

    return {
        catalogs,
        domain,
        linguasPath,
        locales,
        poDir,
        poFiles: catalogs.map((catalog) => catalog.path),
        root: projectRoot,
    };
};

const compileCatalogs = (project: CatalogProject, outputDir: string): string[] => {
    const localeDir = resolve(outputDir);

    for (const catalog of project.catalogs) {
        requireFile(catalog.path);
    }

    return project.catalogs.map((catalog) => {
        const output = join(localeDir, catalog.locale, "LC_MESSAGES", `${project.domain}.mo`);
        mkdirSync(dirname(output), { recursive: true });

        runCliTool({
            tool: "msgfmt",
            args: ["--check", "--output-file", output, catalog.path],
            target: catalog.path,
        });

        return output;
    });
};

const initializeCatalog = (catalog: Catalog, template: string, output: string): void => {
    runCliTool({
        tool: "msginit",
        args: [
            "--no-translator",
            "--no-wrap",
            `--locale=${catalog.locale}`,
            `--input=${template}`,
            `--output-file=${output}`,
        ],
        target: catalog.path,
    });
};

const mergeCatalog = (catalog: Catalog, template: string, output: string): void => {
    requireFile(catalog.path);

    runCliTool({
        tool: "msgmerge",
        args: ["--quiet", "--no-wrap", `--output-file=${output}`, catalog.path, template],
        target: catalog.path,
    });

    chmodSync(output, statSync(catalog.path).mode & MODE_MASK);
};

const prepareCatalog = (
    catalog: Catalog,
    index: number,
    template: string,
    stagingDir: string,
): PreparedCatalog => {
    const output = join(stagingDir, `${String(index)}.po`);
    const isExisting = existsSync(catalog.path);

    if (isExisting) {
        mergeCatalog(catalog, template, output);
    } else {
        initializeCatalog(catalog, template, output);
    }

    return {
        isChanged: !isExisting || !readFileSync(output).equals(readFileSync(catalog.path)),
        output,
        target: catalog.path,
    };
};

const synchronizeCatalogs = (project: CatalogProject): void => {
    if (project.catalogs.length === 0) {
        return;
    }

    const template = join(project.poDir, `${project.domain}.pot`);
    requireFile(template);
    const stagingDir = mkdtempSync(join(project.poDir, ".gtkx-catalog-"));

    try {
        const merged = project.catalogs.map((catalog, index) =>
            prepareCatalog(catalog, index, template, stagingDir));

        for (const catalog of merged) {
            if (catalog.isChanged) {
                renameSync(catalog.output, catalog.target);
            }
        }
    } finally {
        rmSync(stagingDir, { recursive: true, force: true });
    }
};

const isCatalogSource = (root: string, path: string): boolean => {
    const projectRoot = resolve(root);
    const sourcePath = isAbsolute(path) ? resolve(path) : resolve(projectRoot, path);
    const poPath = relative(join(projectRoot, PO_DIRNAME), sourcePath);

    if (!isPathInside(join(projectRoot, PO_DIRNAME), sourcePath)) {
        return false;
    }

    return !poPath.includes(sep) && (poPath === LINGUAS_FILENAME || poPath.endsWith(".po"));
};

export {
    type CatalogProject,
    LOCALE_DIRNAME,
    compileCatalogs,
    isCatalogSource,
    requiresCatalogInitialization,
    resolveCatalogProject,
    synchronizeCatalogs,
};
