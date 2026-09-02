import { sortStrings, sourceStringLiteral, toPosixPath } from "@gtkx/utils";
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
};

const TEMPLATES_DIR = join(import.meta.dirname, "templates");

const listTemplates = (): string[] =>
    sortStrings(
        readdirSync(TEMPLATES_DIR, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name))
            .map((absolute) => toPosixPath(absolute.slice(TEMPLATES_DIR.length + 1)))
            .map((relative) => relative.replace(/\.ejs$/, "")),
    );

const renderFile = async (templateName: string, context: TemplateContext): Promise<string> =>
    ejs.renderFile(join(TEMPLATES_DIR, `${templateName}.ejs`), { ...context, sourceStringLiteral });

export { listTemplates, renderFile, type TemplateContext };
