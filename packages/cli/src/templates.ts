import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import type { TestingFramework } from "./create.js";

export interface TemplateContext {
    name: string;
    appId: string;
    title: string;
    testing: TestingFramework;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getTemplatesDir = (): string => {
    return join(__dirname, "..", "templates");
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
