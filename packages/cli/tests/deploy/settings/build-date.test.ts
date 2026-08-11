import type { Config } from "@gtkx/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDeploySettings } from "../../../src/deploy/settings/index.js";
import { installTempProject, removeTempProject, type TempProject } from "../fixtures/project.js";

const NOW = new Date("2026-08-11T00:00:00Z");
const UNUSABLE_EPOCHS = ["", " ".repeat(3), "Infinity", "-Infinity", "yesterday", "12x34"];

const state: { project: TempProject; epoch: string | undefined } = {
    project: { root: "", settings: {} as TempProject["settings"] },
    epoch: undefined,
};

const config: Config = {
    applicationId: "com.gtkx.tutorial",
    libraries: ["Gtk-4.0"],
    deploy: {
        summary: "Manage your tasks and to-dos",
        categories: ["Office"],
        developer: { name: "GTKX" },
        license: "MPL-2.0",
        version: "1.0.0",
    },
};

const releaseDate = (): string => {
    const settings = resolveDeploySettings({ root: state.project.root, config, now: NOW });

    return settings.releases[0]?.date ?? "";
};

beforeEach(() => {
    state.project = installTempProject();
    state.epoch = process.env.SOURCE_DATE_EPOCH;
});

afterEach(() => {
    removeTempProject(state.project);

    if (state.epoch === undefined) {
        delete process.env.SOURCE_DATE_EPOCH;
    } else {
        process.env.SOURCE_DATE_EPOCH = state.epoch;
    }
});

describe("the generated release date", () => {
    it("uses today when no reproducible timestamp is set", () => {
        delete process.env.SOURCE_DATE_EPOCH;
        expect(releaseDate()).toBe("2026-08-11");
    });

    it("uses SOURCE_DATE_EPOCH so a rebuild produces the same metadata", () => {
        process.env.SOURCE_DATE_EPOCH = "1752364800";
        expect(releaseDate()).toBe("2025-07-13");
    });

    it.each(UNUSABLE_EPOCHS)("falls back to today when SOURCE_DATE_EPOCH is %j", (epoch) => {
        process.env.SOURCE_DATE_EPOCH = epoch;
        expect(releaseDate()).toBe("2026-08-11");
    });
});
