import { describe, expect, it } from "vitest";
import type { DeployConfig, DeployPayload, DeploySettings } from "../../../src/deploy/types.js";
import { renderFlatpakManifest } from "../../../src/deploy/targets/flatpak-manifest.js";
import { tutorialSettings } from "../fixtures/settings.js";

type InlineSource = {
    type?: string;
    "dest-filename"?: string;
};

type FlatpakConfig = NonNullable<DeployConfig["flatpak"]>;

type Module = {
    name: string;
    sources: unknown[];
    "build-commands": string[];
    "build-options": Record<string, unknown>;
    "post-install"?: string[];
};

const payloadFor = (settings: DeploySettings = tutorialSettings(), hasOverlay = true): DeployPayload => ({
    settings,
    node: { path: "/node", version: "24.18.1", glibcFloor: "2.28", isStripped: true },
    stage: [],
    overlays: {
        appimage: [],
        deb: [],
        flatpak: hasOverlay ? [{ rel: "share/licenses/x/LICENSE", abs: "/x", mode: 0o644 }] : [],
        rpm: [],
    },
});

const sourceSettings = (flatpak: Partial<FlatpakConfig> = {}): DeploySettings =>
    tutorialSettings({
        deploy: {
            flatpak: {
                mode: "source",
                packageManager: "npm",
                source: { url: "https://github.com/gtkx-org/gtkx.git", tag: "v1.1.0", commit: "abc123" },
                ...flatpak,
            },
        },
    });

const getModule = (payload: DeployPayload): Module => {
    const manifest = renderFlatpakManifest(payload);

    return (manifest.modules as Module[]).at(-1) as Module;
};

describe("renderFlatpakManifest — prebuilt", () => {
    it("pins the GNOME runtime and names the launcher as the command", () => {
        expect(renderFlatpakManifest(payloadFor())).toMatchObject({
            id: "com.gtkx.tutorial",
            runtime: "org.gnome.Platform",
            "runtime-version": "50",
            sdk: "org.gnome.Sdk",
            command: "gtkx-tutorial",
        });
    });

    it("carries no branch, which Flathub's linter rejects at the top level", () => {
        expect(renderFlatpakManifest(payloadFor())).not.toHaveProperty("branch");
    });

    it("needs no Node SDK extension, because the payload carries its own Node.js", () => {
        expect(renderFlatpakManifest(payloadFor())).not.toHaveProperty("sdk-extensions");
    });

    it("grants a window and hardware rendering, and nothing else", () => {
        expect(renderFlatpakManifest(payloadFor())["finish-args"]).toEqual([
            "--share=ipc",
            "--socket=wayland",
            "--socket=fallback-x11",
            "--device=dri",
        ]);
    });

    it("keeps the payload unstripped, since it is already vendor binaries", () => {
        expect(getModule(payloadFor())["build-options"]).toEqual({ strip: false, "no-debuginfo": true });
    });

    it("copies the staged tree and its overlay into the destination", () => {
        const module = getModule(payloadFor());

        expect(module.sources).toEqual([
            { type: "dir", path: "../../stage", dest: "stage" },
            { type: "dir", path: "../../overlay/flatpak", dest: "overlay" },
        ]);

        expect(module["build-commands"]).toContain("cp -a stage/. ${FLATPAK_DEST}/");
        expect(module["build-commands"]).toContain("cp -a overlay/. ${FLATPAK_DEST}/");
    });

    it("omits the overlay entirely when there is nothing to overlay", () => {
        const module = getModule(payloadFor(tutorialSettings(), false));
        expect(module.sources).toEqual([{ type: "dir", path: "../../stage", dest: "stage" }]);
        expect(module["build-commands"].some((command) => command.includes("overlay"))).toBe(false);
    });
});

describe("renderFlatpakManifest — prebuilt build steps", () => {
    it("leaves the metadata to deploy's own validation, which already ran on the same files", () => {
        const commands = getModule(payloadFor())["build-commands"];
        expect(commands.some((command) => command.includes("desktop-file-validate"))).toBe(false);
        expect(commands.some((command) => command.includes("appstreamcli"))).toBe(false);
    });

    it("compiles the schemas after installing, and only when the app ships any", () => {
        const withSchemas = getModule(payloadFor());
        expect(withSchemas["post-install"]).toEqual(["glib-compile-schemas ${FLATPAK_DEST}/share/glib-2.0/schemas"]);
        const settings = tutorialSettings();
        settings.paths = { ...settings.paths, schemaFiles: [] };
        expect(getModule(payloadFor(settings))).not.toHaveProperty("post-install");
    });

    it("resolves every destination through the flatpak destination variable", () => {
        const commands = getModule(payloadFor())["build-commands"];
        const absolute = commands.filter((command) => command.includes("/app/"));
        expect(absolute).toEqual([]);
    });

    it("lets the project replace the permissions and append its own modules", () => {
        const settings = tutorialSettings({
            deploy: { flatpak: { finishArgs: ["--share=network"], modules: [{ name: "extra" }] } },
        });

        const manifest = renderFlatpakManifest(payloadFor(settings));
        expect(manifest["finish-args"]).toEqual(["--share=network"]);
        expect((manifest.modules as { name: string }[]).map((entry) => entry.name)).toEqual(["extra", "gtkx-tutorial"]);
    });
});

describe("renderFlatpakManifest — source", () => {
    it("adds the Node SDK extension, because the sandbox builds the app itself", () => {
        const payload = payloadFor(sourceSettings());
        expect(renderFlatpakManifest(payload)["sdk-extensions"]).toEqual(["org.freedesktop.Sdk.Extension.node24"]);
    });

    it("builds from a fetchable git source, never from the working tree", () => {
        const sources = getModule(payloadFor(sourceSettings())).sources;

        expect(sources[0]).toEqual({
            type: "git",
            url: "https://github.com/gtkx-org/gtkx.git",
            tag: "v1.1.0",
            commit: "abc123",
        });

        expect(sources.some((source) => (source as { type?: string }).type === "dir")).toBe(false);
    });

    it("carries the generated metadata inline rather than committing it", () => {
        const sources = getModule(payloadFor(sourceSettings())).sources as InlineSource[];
        const inline = sources.filter((source) => source.type === "inline").map((source) => source["dest-filename"]);
        expect(inline).toEqual(["com.gtkx.tutorial.desktop", "com.gtkx.tutorial.metainfo.xml", "launcher.sh"]);
    });

    it("installs dependencies offline with the project's own package manager", () => {
        const commands = getModule(payloadFor(sourceSettings()))["build-commands"];
        expect(commands[0]).toBe("npm ci --offline");
    });

    it("builds the app rather than re-entering the deploy command", () => {
        const commands = getModule(payloadFor(sourceSettings()))["build-commands"];
        expect(commands).toContain("npx gtkx build");
        expect(commands.some((command) => command.includes("gtkx deploy"))).toBe(false);
    });

    it("vendors the offline sources file alongside the git source", () => {
        const sources = getModule(payloadFor(sourceSettings())).sources;
        expect(sources).toContain("generated-sources.json");
    });

    it("validates the metadata inside the sandbox, the way a reviewer expects", () => {
        const commands = getModule(payloadFor(sourceSettings()))["build-commands"];
        expect(commands.at(-2)).toContain("desktop-file-validate");
        expect(commands.at(-1)).toContain("appstreamcli validate --no-net --explain");
    });

    it("installs a single configured icon under the theme directory the desktop entry names", () => {
        const settings = sourceSettings();
        settings.paths = { ...settings.paths, iconsDir: null, iconFile: `${settings.paths.root}/assets/logo.svg` };

        expect(getModule(payloadFor(settings))["build-commands"]).toContain(
            "install -Dm644 assets/logo.svg ${FLATPAK_DEST}/share/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg",
        );
    });
});

describe("renderFlatpakManifest — source Node extension", () => {
    it("mounts the configured extension in the manifest and in every build step that reads it", () => {
        const payload = payloadFor(sourceSettings({ nodeExtension: "org.freedesktop.Sdk.Extension.node22" }));
        const manifest = renderFlatpakManifest(payload);
        const module = (manifest.modules as Module[]).at(-1) as Module;
        expect(manifest["sdk-extensions"]).toEqual(["org.freedesktop.Sdk.Extension.node22"]);
        expect(module["build-options"]["append-path"]).toBe("/usr/lib/sdk/node22/bin");
        expect(module["build-options"].env).toMatchObject({ npm_config_nodedir: "/usr/lib/sdk/node22" });

        expect(module["build-commands"]).toContain(
            "install -Dm755 /usr/lib/sdk/node22/bin/node ${FLATPAK_DEST}/lib/gtkx-tutorial/node",
        );

        expect(module["build-commands"].some((command) => command.includes("node24"))).toBe(false);
    });

    it("rejects an extension id whose mount point it cannot derive", () => {
        const payload = payloadFor(sourceSettings({ nodeExtension: "org.example.Node" }));
        expect(() => renderFlatpakManifest(payload)).toThrow();
    });
});

describe("renderFlatpakManifest — source URL", () => {
    it("rejects an SSH remote, which Flathub's builders cannot clone", () => {
        const payload = payloadFor(sourceSettings({ source: { url: "git@github.com:o/r.git" } }));
        expect(() => renderFlatpakManifest(payload)).toThrow();
    });

    it("accepts an https remote", () => {
        const payload = payloadFor(sourceSettings({ source: { url: "https://github.com/o/r.git", tag: "v1" } }));
        expect(() => renderFlatpakManifest(payload)).not.toThrow();
    });
});
