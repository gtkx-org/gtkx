import { existsSync, readFileSync, renameSync } from "node:fs";

const POT_CREATION_DATE = /^"POT-Creation-Date: .*\\n"$/m;

const isUnchangedTemplate = (previous: string, next: string): boolean => {
    const previousDate = POT_CREATION_DATE.exec(previous)?.[0];

    return previousDate !== undefined && next.replace(POT_CREATION_DATE, () => previousDate) === previous;
};

const replaceCatalogTemplate = (source: string, output: string): void => {
    if (existsSync(output)) {
        const previous = readFileSync(output, "utf8");
        const next = readFileSync(source, "utf8");

        if (next === previous || isUnchangedTemplate(previous, next)) {
            return;
        }
    }

    renameSync(source, output);
};

export { replaceCatalogTemplate };
