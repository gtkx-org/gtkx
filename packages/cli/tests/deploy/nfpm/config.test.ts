import { describe, expect, it } from "vitest";
import type { DeployPayload, DeploySettings, StagedFile } from "../../../src/deploy/types.js";
import { renderNfpmConfig } from "../../../src/deploy/nfpm/config.js";
import { tutorialSettings } from "../fixtures/settings.js";

type Contents = { src?: string; dst: string; type?: string; file_info?: { mode: number } }[];

const staged = (rel: string, mode = 0o644): StagedFile => ({ rel, abs: `/project/build/stage/${rel}`, mode });

const payloadFor = (settings: DeploySettings = tutorialSettings()): DeployPayload => ({
    settings,
    node: { path: "/node", version: "24.18.1", glibcFloor: "2.28", isStripped: true },
    stage: [
        staged("bin/gtkx-tutorial", 0o755),
        staged("lib/gtkx-tutorial/bundle.js"),
        staged("lib/gtkx-tutorial/gtkx.node", 0o755),
        staged("share/applications/com.gtkx.tutorial.desktop"),
        staged("share/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg"),
    ],
    overlays: {
        appimage: [],
        deb: [staged("share/doc/gtkx-tutorial/copyright")],
        flatpak: [],
        rpm: [staged("share/licenses/gtkx-tutorial/LICENSE")],
    },
});

const getContents = (config: Record<string, unknown>): Contents => config.contents as Contents;
const destinations = (config: Record<string, unknown>): string[] => getContents(config).map((entry) => entry.dst);

const ownedDirectories = (config: Record<string, unknown>): string[] =>
    getContents(config).filter((entry) => entry.type === "dir").map((entry) => entry.dst);

describe("renderNfpmConfig — shared shape", () => {
    it("pins the version schema so nfpm does not reinterpret the version", () => {
        expect(renderNfpmConfig(payloadFor(), "deb").version_schema).toBe("none");
    });

    it("names the package and architecture in each format's own vocabulary", () => {
        expect(renderNfpmConfig(payloadFor(), "deb")).toMatchObject({ name: "gtkx-tutorial", arch: "amd64" });
        expect(renderNfpmConfig(payloadFor(), "rpm")).toMatchObject({ name: "gtkx-tutorial", arch: "x86_64" });
    });

    it("writes the maintainer as a name and address", () => {
        expect(renderNfpmConfig(payloadFor(), "deb").maintainer).toBe("GTKX <hello@gtkx.dev>");
    });

    it("carries the derived glibc floor into the dependency list", () => {
        expect(renderNfpmConfig(payloadFor(), "deb").depends).toContain("libc6 (>= 2.28)");
        expect(renderNfpmConfig(payloadFor(), "rpm").depends).toContain("glibc >= 2.28");
    });

    it("serializes an epoch as a string, which is the type nfpm expects", () => {
        const settings = tutorialSettings();
        settings.versions = { ...settings.versions, epoch: 2 };
        expect(renderNfpmConfig(payloadFor(settings), "deb").epoch).toBe("2");
    });

    it("omits the epoch when none is configured", () => {
        expect(renderNfpmConfig(payloadFor(), "deb")).not.toHaveProperty("epoch");
    });

    it("gives every content entry an absolute source path", () => {
        const contents = getContents(renderNfpmConfig(payloadFor(), "deb"));
        const withSource = contents.filter((entry) => entry.src !== undefined);
        expect(withSource.length).toBeGreaterThan(0);
        expect(withSource.every((entry) => entry.src?.startsWith("/"))).toBe(true);
    });

    it("writes no maintainer scripts, leaving the caches to distribution triggers", () => {
        expect(renderNfpmConfig(payloadFor(), "deb")).not.toHaveProperty("scripts");
        expect(renderNfpmConfig(payloadFor(), "rpm")).not.toHaveProperty("scripts");
    });

    it("writes maintainer scripts only when the project configures them", () => {
        const settings = tutorialSettings({ deploy: { scripts: { postInstall: "scripts/post.sh" } } });
        expect(renderNfpmConfig(payloadFor(settings), "deb").scripts).toEqual({ postinstall: "scripts/post.sh" });
    });
});

describe("renderNfpmConfig — deb", () => {
    it("derives the archive section from the categories", () => {
        expect(renderNfpmConfig(payloadFor(), "deb")).toMatchObject({ section: "gnome", priority: "optional" });
    });

    it("separates description paragraphs with the Debian continuation marker", () => {
        const settings = tutorialSettings({ description: ["First.", "Second."] });

        expect(renderNfpmConfig(payloadFor(settings), "deb").description)
            .toBe("Manage your tasks and to-dos\nFirst.\n.\nSecond.");
    });

    it("includes its own overlay and not another target's", () => {
        const paths = destinations(renderNfpmConfig(payloadFor(), "deb"));
        expect(paths).toContain("/usr/share/doc/gtkx-tutorial/copyright");
        expect(paths).not.toContain("/usr/share/licenses/gtkx-tutorial/LICENSE");
    });

    it("claims no directories, because dpkg tracks them itself", () => {
        const config = renderNfpmConfig(payloadFor(), "deb");
        expect(ownedDirectories(config)).toEqual([]);
    });

    it("carries signing settings only when configured", () => {
        const settings = tutorialSettings({ deploy: { signing: { deb: { keyFile: "/key.asc" } } } });
        const deb = renderNfpmConfig(payloadFor(settings), "deb").deb as Record<string, unknown>;
        expect(deb.signature).toEqual({ key_file: "/key.asc" });
        expect(renderNfpmConfig(payloadFor(), "deb").deb).not.toHaveProperty("signature");
    });
});

describe("renderNfpmConfig — rpm", () => {
    it("derives the group from the categories and repeats the summary", () => {
        const rpm = renderNfpmConfig(payloadFor(), "rpm").rpm as Record<string, unknown>;
        expect(rpm).toMatchObject({ group: "Applications/Productivity", summary: "Manage your tasks and to-dos" });
    });

    it("separates description paragraphs with a blank line", () => {
        const settings = tutorialSettings({ description: ["First.", "Second."] });
        expect(renderNfpmConfig(payloadFor(settings), "rpm").description).toBe("First.\n\nSecond.");
    });

    it("claims only the directories it creates itself", () => {
        const config = renderNfpmConfig(payloadFor(), "rpm");
        expect(ownedDirectories(config)).toEqual(["/usr/lib/gtkx-tutorial", "/usr/share/licenses/gtkx-tutorial"]);
    });

    it("never claims a directory the filesystem package owns", () => {
        const owned = ownedDirectories(renderNfpmConfig(payloadFor(), "rpm"));
        const reserved = ["/usr", "/usr/bin", "/usr/lib", "/usr/share", "/usr/share/applications", "/usr/share/icons"];

        for (const directory of reserved) {
            expect(owned).not.toContain(directory);
        }
    });

    it("includes its own overlay and not another target's", () => {
        const paths = destinations(renderNfpmConfig(payloadFor(), "rpm"));
        expect(paths).toContain("/usr/share/licenses/gtkx-tutorial/LICENSE");
        expect(paths).not.toContain("/usr/share/doc/gtkx-tutorial/copyright");
    });

    it("lets each format carry its own package name", () => {
        const settings = tutorialSettings({ deploy: { rpm: { packageName: "tasks" } } });
        expect(renderNfpmConfig(payloadFor(settings), "rpm").name).toBe("tasks");
        expect(renderNfpmConfig(payloadFor(settings), "deb").name).toBe("gtkx-tutorial");
    });
});
