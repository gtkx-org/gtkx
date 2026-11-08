import * as Gio from "@gtkx/gi/gio";
import { cpSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";
import schema from "../data/dev.gtkx.Notes.gschema.xml";

const root = mkdtempSync(join(tmpdir(), "gtkx-notes-"));
const folder = join(root, "Notes");

process.env.XDG_DATA_HOME = join(root, "data");

beforeEach(() => {
    rmSync(folder, { recursive: true, force: true });
    cpSync(join(import.meta.dirname, "fixtures"), folder, { recursive: true });
    utimesSync(join(folder, "Groceries.md"), new Date("2026-11-01"), new Date("2026-11-01"));
    utimesSync(join(folder, "Reading list.md"), new Date("2026-11-02"), new Date("2026-11-02"));

    const settings = Gio.Settings.new(schema.id);
    for (const key of Object.keys(schema.keys)) {
        settings.reset(key);
    }
    settings.setString("folder", folder);
});

afterAll(() => {
    rmSync(root, { recursive: true, force: true });
});
