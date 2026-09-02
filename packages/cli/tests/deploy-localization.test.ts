import { describe, expect, it } from "vitest";
import {
    APPLICATION_ID,
    config,
    deployProbe,
    expectLocalizedDeploy,
    expectMalformedCatalogFailure,
    expectMissingSkipCatalogFailure,
    expectPlainBuildPreservesMetadata,
    expectRedeployDropsRemovedMetadata,
    expectSkipBuildPreservesPot,
    expectSuccessfulDeploy,
    findInlineSource,
    flatpakModule,
    FRENCH_MIME_DESCRIPTION,
    FRENCH_NAME,
    GERMAN_NAME,
    LOCALE_INSTALL,
    LOCALIZATION_PAYLOAD,
    LOCALIZED_DEPLOY_BLOCK,
    localizedFiles,
    MIME_FILENAME,
    PINNED_SOURCE,
    PNPM_PIN,
    projectFiles,
    SOURCE_ARGS,
    sourceConfig,
    sourceFiles,
} from "./deploy-helpers.js";

describe("gtkx deploy (gettext localization)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-localized-",
        config: config(LOCALIZED_DEPLOY_BLOCK),
        files: localizedFiles(projectFiles()),
        args: ["deploy", "--print-manifests", "--target", "deb"],
    });

    it("localizes the staged metadata and installs every compiled catalog", () => {
        expectLocalizedDeploy(state);
    });

    it("preserves metadata while removing stale source messages on a plain build", () => {
        expectPlainBuildPreservesMetadata(state.project);
    });

    it("does not rewrite the catalog template when the build is skipped", () => {
        expectSkipBuildPreservesPot(state.project);
    });

    it("replaces old metadata when a later deploy removes it", () => {
        expectRedeployDropsRemovedMetadata(state.project);
    });
});

describe("gtkx deploy (gettext localization in Flatpak source mode)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-localized-source-",
        config: sourceConfig(PINNED_SOURCE, LOCALIZATION_PAYLOAD),
        files: localizedFiles(sourceFiles(PNPM_PIN)),
        args: SOURCE_ARGS,
    });

    it("uses the localized metadata and build catalogs in Flatpak source mode", () => {
        expectSuccessfulDeploy(state);
        const sourceModule = flatpakModule(state.project);

        expect(findInlineSource(sourceModule, `${APPLICATION_ID}.desktop`)?.contents).toContain(
            `Name[fr]=${FRENCH_NAME}`,
        );

        expect(findInlineSource(sourceModule, `${APPLICATION_ID}.metainfo.xml`)?.contents).toContain(
            `<name xml:lang="de">${GERMAN_NAME}</name>`,
        );

        expect(findInlineSource(sourceModule, MIME_FILENAME)?.contents).toContain(FRENCH_MIME_DESCRIPTION);
        expect(sourceModule["build-commands"]).toContain(LOCALE_INSTALL);
    });
});

describe("gtkx deploy (invalid gettext catalog sources)", () => {
    it("fails for a malformed catalog and a missing skip-build catalog", () => {
        expectMalformedCatalogFailure();
        expectMissingSkipCatalogFailure();
    });
});
