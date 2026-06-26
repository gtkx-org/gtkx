import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sortedStrings } from "@gtkx/utils";

export type TemplateContext = {
    name: string;
    applicationId: string;
    title: string;
    includeTesting: boolean;
};

const SUBSTITUTIONS: Record<string, (context: TemplateContext) => string> = {
    name: (context) => context.name,
    applicationId: (context) => context.applicationId,
    title: (context) => context.title,
};

const getTemplatesDir = (): string => {
    return join(import.meta.dirname, "..", "templates");
};

export const listTemplates = (): string[] =>
    sortedStrings(
        readdirSync(getTemplatesDir(), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name))
            .map((absolute) => absolute.slice(getTemplatesDir().length + 1).replaceAll(/[/\\]/g, "/")),
    );

export const renderFile = (templateName: string, context: TemplateContext): string => {
    const templateContent = readFileSync(join(getTemplatesDir(), templateName), "utf-8");
    return templateContent.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
        const substitution = SUBSTITUTIONS[key];
        return substitution ? substitution(context) : match;
    });
};
