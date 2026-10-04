import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applicationId } from "virtual:gtkx-config";
import { afterAll, beforeEach } from "vitest";

const dataHome = mkdtempSync(join(tmpdir(), "gtkx-tutorial-"));

process.env.XDG_DATA_HOME = dataHome;

const { useStore } = await import("../src/store/index.js");
const { seedLists, seedTasks } = await import("../src/store/seed.js");

beforeEach(() => {
    rmSync(join(dataHome, applicationId), { recursive: true, force: true });
    useStore.setState({
        tasks: seedTasks,
        lists: seedLists,
        collapsed: false,
        filter: "all",
        searchMode: false,
        searchQuery: "",
        dialog: { kind: "none" },
    });
});

afterAll(() => {
    rmSync(dataHome, { recursive: true, force: true });
});
