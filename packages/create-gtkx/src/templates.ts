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

export const TEMPLATE_SUFFIX = ".ejs";

const getTemplatesDir = (): string => {
    return join(import.meta.dirname, "..", "templates");
};

const renderTemplate = (templatePath: string, context: TemplateContext): string => {
    const templateContent = readFileSync(templatePath, "utf-8");
    return ejs.render(templateContent, context);
};

export const listTemplates = (): string[] =>
    sortedStrings(
        readdirSync(getTemplatesDir(), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(TEMPLATE_SUFFIX))
            .map((entry) => join(entry.parentPath, entry.name))
            .map((absolute) => absolute.slice(getTemplatesDir().length + 1).replaceAll(/[/\\]/g, "/")),
    );

export const renderFile = (templateName: string, context: TemplateContext): string => {
    const templatesDir = getTemplatesDir();
    const templatePath = join(templatesDir, templateName);
    return renderTemplate(templatePath, context);
};
