import { describe, expect, it } from "vitest";
import type { DeployPayload, DeploySettings } from "../../../src/deploy/types.js";
import { artifactNameFor as nfpmArtifactNameFor } from "../../../src/deploy/nfpm/pack.js";
import { artifactNameFor as appimageArtifactNameFor, toolArgsFor } from "../../../src/deploy/targets/appimage.js";
import { builderArgsFor, bundleArgsFor } from "../../../src/deploy/targets/flatpak.js";
import { tutorialSettings } from "../fixtures/settings.js";

const payloadFor = (settings: DeploySettings): DeployPayload => ({
    settings,
    node: null,
    stage: [],
    overlays: { appimage: [], deb: [], flatpak: [], rpm: [] },
});

const withVersion = (packageVersion: string, release = "1"): DeploySettings => {
    const settings = tutorialSettings();
    settings.versions = { ...settings.versions, packageVersion, debRevision: release, rpmRelease: release };

    return settings;
};

describe("the deb and rpm artifact names", () => {
    it("follows the Debian convention of name_version-revision_arch", () => {
        const payload = payloadFor(tutorialSettings());
        expect(nfpmArtifactNameFor(payload, "deb")).toBe("gtkx-tutorial_1.0.0-1_amd64.deb");
    });

    it("follows the RPM convention of name-version-release.arch", () => {
        const payload = payloadFor(tutorialSettings());
        expect(nfpmArtifactNameFor(payload, "rpm")).toBe("gtkx-tutorial-1.0.0-1.x86_64.rpm");
    });

    it("carries a prerelease version through both conventions", () => {
        const payload = payloadFor(withVersion("1.0.0~beta.1"));
        expect(nfpmArtifactNameFor(payload, "deb")).toBe("gtkx-tutorial_1.0.0~beta.1-1_amd64.deb");
        expect(nfpmArtifactNameFor(payload, "rpm")).toBe("gtkx-tutorial-1.0.0~beta.1-1.x86_64.rpm");
    });

    it("uses each format's own package name when they differ", () => {
        const names = { deb: { packageName: "tasks-deb" }, rpm: { packageName: "tasks" } };
        const settings = tutorialSettings({ deploy: names });
        expect(nfpmArtifactNameFor(payloadFor(settings), "deb")).toContain("tasks-deb_");
        expect(nfpmArtifactNameFor(payloadFor(settings), "rpm")).toContain("tasks-1.0.0");
    });
});

describe("the AppImage artifact name", () => {
    it("uses the display name, with spaces replaced so the file is easy to run", () => {
        expect(appimageArtifactNameFor(tutorialSettings({ name: "My Tasks" })))
            .toBe("My_Tasks-1.0.0-x86_64.AppImage");
    });

    it("honours a configured file name verbatim", () => {
        const settings = tutorialSettings({ deploy: { appimage: { fileName: "Tasks.AppImage" } } });
        expect(appimageArtifactNameFor(settings)).toBe("Tasks.AppImage");
    });
});

describe("the appimagetool arguments", () => {
    it("pins the runtime and skips the AppStream pass that deploy already ran", () => {
        const args = toolArgsFor(tutorialSettings(), "/cache/runtime", "/app.AppDir", "/out/App.AppImage");
        expect(args).toContain("--no-appstream");

        expect(args.slice(args.indexOf("--runtime-file"), args.indexOf("--runtime-file") + 2))
            .toEqual(["--runtime-file", "/cache/runtime"]);

        expect(args.slice(-2)).toEqual(["/app.AppDir", "/out/App.AppImage"]);
    });

    it("passes compression, update information and signing only when configured", () => {
        const plain = toolArgsFor(tutorialSettings(), "/runtime", "/dir", "/out");
        expect(plain).not.toContain("--comp");
        expect(plain).not.toContain("-u");
        expect(plain).not.toContain("--sign-key");

        const settings = tutorialSettings({
            deploy: {
                appimage: { compression: "zstd", updateInformation: "gh-releases-zsync|o|r|latest|A-*.AppImage" },
                signing: { appimage: { gpgKeyId: "ABC123" } },
            },
        });

        const configured = toolArgsFor(settings, "/runtime", "/dir", "/out");
        expect(configured).toEqual(expect.arrayContaining(["--comp", "zstd", "-u", "-s", "--sign-key", "ABC123"]));
    });

    it("prefers a project-supplied runtime file over the downloaded one", () => {
        const settings = tutorialSettings({ deploy: { appimage: { runtimeFile: "/project/runtime" } } });
        const args = toolArgsFor(settings, "/cache/runtime", "/dir", "/out");
        expect(args).toContain("/project/runtime");
        expect(args).not.toContain("/cache/runtime");
    });
});

describe("the flatpak-builder arguments", () => {
    it("builds into its own state and repository directories under the target directory", () => {
        const args = builderArgsFor(tutorialSettings(), "/project/build/targets/flatpak");
        expect(args).toContain("--force-clean");
        expect(args).toContain("--user");
        expect(args).toContain("--install-deps-from=flathub");
        expect(args).toContain("--default-branch=stable");
        expect(args).toContain("--state-dir=/project/build/targets/flatpak/state");
        expect(args).toContain("--repo=/project/build/targets/flatpak/repo");
    });

    it("keeps rofiles-fuse on by default and disables it only when asked", () => {
        expect(builderArgsFor(tutorialSettings(), "/dir")).not.toContain("--disable-rofiles-fuse");
        const settings = tutorialSettings({ deploy: { flatpak: { shouldUseRofilesFuse: false } } });
        expect(builderArgsFor(settings, "/dir")).toContain("--disable-rofiles-fuse");
    });
});

describe("the flatpak bundle arguments", () => {
    it("names the application, its branch and its architecture", () => {
        const args = bundleArgsFor(tutorialSettings(), "/out/app.flatpak");
        expect(args[0]).toBe("build-bundle");
        expect(args).toContain("com.gtkx.tutorial");
        expect(args).toContain("stable");
        expect(args).toContain("--arch=x86_64");
    });

    it("points at Flathub so an installed bundle can resolve its runtime", () => {
        expect(bundleArgsFor(tutorialSettings(), "/out/app.flatpak"))
            .toContain("--runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo");
    });

    it("honours a configured branch and runtime repository", () => {
        const settings = tutorialSettings({
            deploy: { flatpak: { branch: "beta", runtimeRepo: "https://example.com/my.flatpakrepo" } },
        });

        const args = bundleArgsFor(settings, "/out/app.flatpak");
        expect(args).toContain("beta");
        expect(args).toContain("--runtime-repo=https://example.com/my.flatpakrepo");
    });

    it("signs the bundle only when a key is configured", () => {
        expect(bundleArgsFor(tutorialSettings(), "/out")).not.toContain("--gpg-sign=KEY");

        const settings = tutorialSettings({
            deploy: { signing: { flatpak: { gpgKeyId: "KEY", gpgHomeDir: "/keys" } } },
        });

        const args = bundleArgsFor(settings, "/out");
        expect(args).toContain("--gpg-sign=KEY");
        expect(args).toContain("--gpg-homedir=/keys");
    });
});
