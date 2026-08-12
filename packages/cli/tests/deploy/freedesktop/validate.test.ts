import type { Config } from "@gtkx/config";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDesktopEntry } from "../../../src/deploy/freedesktop/desktop-entry.js";
import { renderMetainfo } from "../../../src/deploy/freedesktop/metainfo.js";
import { validateDesktopEntry, validateMetainfo } from "../../../src/deploy/freedesktop/validate.js";
import { resolveDeploySettings } from "../../../src/deploy/settings/index.js";
import { installTempProject, removeTempProject, type TempProject } from "../fixtures/project.js";
import { tutorialSettings } from "../fixtures/settings.js";
import { hasAppstreamCli, hasDesktopFileValidate } from "../tool-probes.js";

const NOW = new Date("2026-08-11T00:00:00Z");

const state: { dir: string; project: TempProject } = {
    dir: "",
    project: { root: "", settings: {} as TempProject["settings"] },
};

const RELEASES_CONFIG: Config = {
    applicationId: "com.gtkx.tutorial",
    libraries: ["Gtk-4.0"],
    deploy: {
        summary: "Manage your tasks and to-dos",
        description: ["A task manager built with GTKX that keeps every to-do list in order and always in sync."],
        categories: ["Office"],
        developer: { name: "GTKX" },
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",
        version: "1.1.0",
        releases: [
            { version: "1.0.0", date: "2026-07-13" },
            { version: "1.1.0", date: "2026-08-11" },
        ],
    },
};

const withoutSummary = (document: string): string =>
    document
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("<summary>"))
        .join("\n");

const write = (name: string, contents: string): string => {
    const path = join(state.dir, name);
    writeFileSync(path, contents);

    return path;
};

beforeEach(() => {
    state.dir = mkdtempSync(join(tmpdir(), "gtkx-deploy-validate-"));
    state.project = installTempProject();
});

afterEach(() => {
    rmSync(state.dir, { recursive: true, force: true });
    removeTempProject(state.project);
});

describe.skipIf(!hasDesktopFileValidate())("validateDesktopEntry", () => {
    it("accepts the generated tutorial entry", () => {
        const path = write("com.gtkx.tutorial.desktop", renderDesktopEntry(tutorialSettings()));

        expect(() => {
            validateDesktopEntry(path);
        }).not.toThrow();
    });

    it("rejects an unregistered category", () => {
        const path = write("bad.desktop", renderDesktopEntry(tutorialSettings({ categories: ["Ofice"] })));

        expect(() => {
            validateDesktopEntry(path);
        }).toThrow(/unregistered value/);
    });

    it("rejects an entry with no main category, which the validator reports only as a hint", () => {
        const path = write("hint.desktop", renderDesktopEntry(tutorialSettings({ categories: ["ProjectManagement"] })));

        expect(() => {
            validateDesktopEntry(path);
        }).toThrow(/main category/);
    });
});

describe.skipIf(!hasAppstreamCli())("validateMetainfo", () => {
    it("accepts the generated tutorial metainfo", () => {
        const path = write("com.gtkx.tutorial.metainfo.xml", renderMetainfo(tutorialSettings()));

        expect(() => {
            validateMetainfo(path, true);
        }).not.toThrow();
    });

    it("rejects a component with no summary", () => {
        const document = renderMetainfo(tutorialSettings());
        const path = write("nosummary.metainfo.xml", withoutSummary(document));

        expect(() => {
            validateMetainfo(path, true);
        }).toThrow(/not valid/);
    });

    it("rejects a summary long enough to be a warning", () => {
        const summary = "word ".repeat(40).trim();
        const document = renderMetainfo(tutorialSettings({ summary }));
        const path = write("longsummary.metainfo.xml", document);

        expect(() => {
            validateMetainfo(path, true);
        }).toThrow(/not valid/);
    });

    it("lets a warning through when no store-bound target is selected", () => {
        const settings = tutorialSettings({ homepage: null, urls: {} });
        const path = write("nohomepage.metainfo.xml", renderMetainfo(settings));

        expect(() => {
            validateMetainfo(path, false);
        }).not.toThrow();
    });

    it("blocks that same warning when a store-bound target is selected", () => {
        const settings = tutorialSettings({ homepage: null, urls: {} });
        const path = write("nohomepage.metainfo.xml", renderMetainfo(settings));

        expect(() => {
            validateMetainfo(path, true);
        }).toThrow(/url-homepage-missing/);
    });

    it("names the config key that fixes each rule", () => {
        const settings = tutorialSettings({ homepage: null, urls: {} });
        const path = write("nohomepage.metainfo.xml", renderMetainfo(settings));

        expect(() => {
            validateMetainfo(path, true);
        }).toThrow(/set `deploy\.homepage`/);
    });
});

describe.skipIf(!hasAppstreamCli())("validateMetainfo — release ordering", () => {
    it("accepts a changelog configured oldest first", () => {
        const settings = resolveDeploySettings({ root: state.project.root, config: RELEASES_CONFIG, now: NOW });
        const path = write("ordered.metainfo.xml", renderMetainfo(settings));

        expect(() => {
            validateMetainfo(path, true);
        }).not.toThrow();
    });
});
