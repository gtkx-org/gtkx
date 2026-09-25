import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    APPLICATION_ID,
    CALLBACK_ACTION_PAGE,
    MENU_ITEM_PAGE,
    OUT_DIR,
    readPage,
    SHORTCUT_TRIGGER_PAGE,
} from "./docs-fixture.js";

describe("gtkx docs (a fresh project)", () => {
    it("includes built-in props before bindings have been generated", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-docs-first-run-",
            config: `export default { applicationId: "${APPLICATION_ID}" };`,
        });

        runCliOrThrow(project, ["docs", "--out", OUT_DIR]);
        expect(readPage(project, CALLBACK_ACTION_PAGE)).toContain("### `callback`");
        expect(readPage(project, MENU_ITEM_PAGE)).toContain("### `submenu`");
        expect(readPage(project, MENU_ITEM_PAGE)).toContain("### `section`");
        expect(readPage(project, SHORTCUT_TRIGGER_PAGE)).toContain("### `accelerator`");
    });
});
