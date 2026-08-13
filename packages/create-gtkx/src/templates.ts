import { sortStrings, sourceStringLiteral } from "@gtkx/utils";
import ejs from "ejs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

type TemplateContext = {
    name: string;
    applicationId: string;
    title: string;
    shouldIncludeTesting: boolean;
    isTypescript: boolean;
    importExtension: string;
    developerName: string;
    developerEmail: string | null;
};

const getTemplatesDir = (): string => {
    return join(import.meta.dirname, "templates");
};

const listTemplates = (): string[] =>
    sortStrings(
        readdirSync(getTemplatesDir(), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name))
            .map((absolute) => absolute.slice(getTemplatesDir().length + 1).replaceAll(/[/\\]/g, "/"))
            .map((relative) => relative.replace(/\.ejs$/, "")),
    );

const renderFile = async (templateName: string, context: TemplateContext): Promise<string> =>
    ejs.renderFile(join(getTemplatesDir(), `${templateName}.ejs`), { ...context, sourceStringLiteral });

export { listTemplates, renderFile, type TemplateContext };
