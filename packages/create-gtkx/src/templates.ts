import { sortStrings, sourceStringLiteral } from "@gtkx/utils";
import type { PackageManager } from "./package-managers.js";
import ejs from "ejs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

type TemplateContext = {
    name: string;
    applicationId: string;
    displayName: string;
    shouldIncludeTesting: boolean;
    isTypescript: boolean;
    importExtension: string;
    developerName: string;
    developerEmail: string | null;
    packageManager: PackageManager;
};

const TEMPLATES_DIR = join(import.meta.dirname, "templates");

// Yarn PnP reports relative `parentPath`s for recursive listings: https://github.com/yarnpkg/berry/issues/7315
const listFiles = (directory: string, prefix: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const relative = `${prefix}${entry.name}`;

        if (entry.isDirectory()) {
            return listFiles(join(directory, entry.name), `${relative}/`);
        }

        return entry.isFile() ? [relative] : [];
    });

const listTemplates = (): string[] =>
    sortStrings(listFiles(TEMPLATES_DIR, "").map((relative) => relative.replace(/\.ejs$/, "")));

const renderFile = async (templateName: string, context: TemplateContext): Promise<string> =>
    ejs.renderFile(join(TEMPLATES_DIR, `${templateName}.ejs`), { ...context, sourceStringLiteral });

export { listTemplates, renderFile, type TemplateContext };
