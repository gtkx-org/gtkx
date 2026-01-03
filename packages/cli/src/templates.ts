import { readFileSync } from "node:fs";
import { join } from "node:path";
import ejs from "ejs";
import type { TestingOption } from "./create.js";

export interface TemplateContext {
    name: string;
    appId: string;
    title: string;
    testing: TestingOption;
}

const getTemplatesDir = (): string => {
    return join(import.meta.dirname, "..", "templates");
};

const renderTemplate = (templatePath: string, context: TemplateContext): string => {
    const templateContent = readFileSync(templatePath, "utf-8");
    return ejs.render(templateContent, context);
};

export const renderFile = (templateName: string, context: TemplateContext): string => {
    const templatesDir = getTemplatesDir();
    const templatePath = join(templatesDir, templateName);
    return renderTemplate(templatePath, context);
};
