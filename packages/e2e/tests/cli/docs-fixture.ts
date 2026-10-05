import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clidocs";
const OUT_DIR = join("site", "elements");
const BASE_PATH = "/elements";
const DOCUMENTED_PAGE = "documented/note.md";
const CALLBACK_ACTION_PAGE = "gtk/callback-action.md";
const SHORTCUT_TRIGGER_PAGE = "gtk/shortcut-trigger.md";
const MENU_ITEM_PAGE = "gio/menu-item.md";
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));

const config = (body = "", libraries = STORE_LIBRARIES): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(libraries)}` +
    `${body} };\n`;

const docsDir = (project: CliProject): string => join(project.root, OUT_DIR);

const runDocs = (project: CliProject, args: string[] = []): number | null =>
    runCli(project, ["docs", "--out", OUT_DIR, "--base-path", BASE_PATH, ...args]).status;

const readPage = (project: CliProject, name: string): string => readFileSync(join(docsDir(project), name), "utf8");

export {
    APPLICATION_ID,
    BASE_PATH,
    CALLBACK_ACTION_PAGE,
    config,
    docsDir,
    DOCUMENTED_PAGE,
    FIXTURE_GIR,
    MENU_ITEM_PAGE,
    OUT_DIR,
    readPage,
    runDocs,
    SHORTCUT_TRIGGER_PAGE,
};
