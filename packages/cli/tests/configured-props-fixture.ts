import { cpSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CliProject, runCliOrThrow } from "./cli-project.js";

const FIXTURE = fileURLToPath(new URL("fixtures/configured-props/@audit", import.meta.url));
const OUTPUT = "docs/reference";
const BUTTON_PAGE = "gtk/button.md";
const PROPS_MODULE = "@audit/element-props";
const UNION_MODULE = "@audit/union-props";

const readButton = (root: string, directory = OUTPUT): string =>
    readFileSync(join(root, directory, BUTTON_PAGE), "utf8");

const stamp = (root: string): number => statSync(join(root, OUTPUT, BUTTON_PAGE)).mtimeMs;

const installConfiguredProps = (root: string): void => {
    cpSync(FIXTURE, join(root, "node_modules", "@audit"), { recursive: true });
};

const writePropsConfig = (root: string, exportName = "AliasProps", moduleName = PROPS_MODULE): void => {
    const config = {
        applicationId: "org.gtkx.configuredprops",
        agents: { rules: false, reference: true },
        elements: { config: { GtkButton: { props: { module: moduleName, export: exportName } } } },
    };
    writeFileSync(join(root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
};

const runDocs = (project: CliProject): void => {
    runCliOrThrow(project, ["docs", "--out", OUTPUT]);
};

export {
    installConfiguredProps,
    OUTPUT,
    PROPS_MODULE,
    readButton,
    runDocs,
    stamp,
    UNION_MODULE,
    writePropsConfig,
};
