import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ejs from "ejs";
import type { TestingOption } from "./create/options.js";

export type TemplateContext = {
    name: string;
    applicationId: string;
    title: string;
    testing: TestingOption;
};

/** Filename suffix every project template carries. */
export const TEMPLATE_SUFFIX = ".ejs";

const getTemplatesDir = (): string => {
    return join(import.meta.dirname, "..", "templates");
};

const renderTemplate = (templatePath: string, context: TemplateContext): string => {
    const templateContent = readFileSync(templatePath, "utf-8");
    return ejs.render(templateContent, context);
};

/**
 * Lists every project template, as its path relative to the templates
 * directory using forward slashes (e.g. `src/app.tsx.ejs`, `claude/SKILL.md.ejs`).
 * The template tree is the single manifest of project contents, so adding or
 * renaming a template is picked up without editing the scaffolder.
 *
 * @returns The relative template paths, in deterministic (sorted) order.
 */
export const listTemplates = (): string[] =>
    readdirSync(getTemplatesDir(), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(TEMPLATE_SUFFIX))
        .map((entry) => join(entry.parentPath, entry.name))
        .map((absolute) =>
            absolute
                .slice(getTemplatesDir().length + 1)
                .split(/[/\\]/)
                .join("/"),
        )
        .sort((a, b) => a.localeCompare(b));

export const renderFile = (templateName: string, context: TemplateContext): string => {
    const templatesDir = getTemplatesDir();
    const templatePath = join(templatesDir, templateName);
    return renderTemplate(templatePath, context);
};
