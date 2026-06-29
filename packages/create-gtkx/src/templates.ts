import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sortedStrings } from "@gtkx/utils";
import ejs from "ejs";

export type TemplateContext = {
    name: string;
    applicationId: string;
    title: string;
    includeTesting: boolean;
};

const getTemplatesDir = (): string => {
    return join(import.meta.dirname, "templates");
};

export const listTemplates = (): string[] =>
    sortedStrings(
        readdirSync(getTemplatesDir(), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name))
            .map((absolute) => absolute.slice(getTemplatesDir().length + 1).replaceAll(/[/\\]/g, "/"))
            .map((relative) => relative.replace(/\.ejs$/, "")),
    );

export const renderFile = (templateName: string, context: TemplateContext): string => {
    const templateContent = readFileSync(join(getTemplatesDir(), `${templateName}.ejs`), "utf-8");
    return ejs.render(templateContent, context);
};
