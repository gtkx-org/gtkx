import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const createStorybookEntry = (root: string): string => {
    createRequire(resolve(root, "package.json")).resolve("@gtkx/storybook/package.json");
    const path = resolve(root, ".gtkx/storybook-entry.ts");
    const source = [
        'import { startStorybook } from "@gtkx/storybook/explorer";',
        'import { applicationId } from "virtual:gtkx-config";',
        "const explorer = startStorybook({ applicationId });",
        "export const updateStories = explorer.updateStories;",
        "export const reportStorybookError = explorer.reportStorybookError;",
        "",
    ].join("\n");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);

    return path;
};

export { createStorybookEntry };
