import { existsSync, readFileSync, renameSync } from "node:fs";

const POT_CREATION_DATE = /^"POT-Creation-Date: .*\\n"$/m;

const isUnchangedCatalog = (previous: string, next: string): boolean => {
    if (next === previous) {
        return true;
    }

    const previousDate = POT_CREATION_DATE.exec(previous)?.[0];

    return previousDate !== undefined && next.replace(POT_CREATION_DATE, () => previousDate) === previous;
};

const replaceCatalogTemplate = (source: string, output: string): void => {
    if (existsSync(output) && isUnchangedCatalog(readFileSync(output, "utf8"), readFileSync(source, "utf8"))) {
        return;
    }

    renameSync(source, output);
};

export { isUnchangedCatalog, replaceCatalogTemplate };
