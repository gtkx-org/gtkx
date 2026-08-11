import { describe, expect, it } from "vitest";
import type { PackageManifest } from "../../../src/deploy/settings/package-manifest.js";
import { missingDeployError } from "../../../src/deploy/settings/starter.js";

const APPLICATION_ID = "com.gtkx.tutorial";

const EMPTY_MANIFEST: PackageManifest = {
    name: null,
    version: null,
    description: null,
    license: null,
    homepage: null,
    author: { name: null, email: null },
};

const manifestWith = (overrides: Partial<PackageManifest> = {}): PackageManifest => ({
    ...EMPTY_MANIFEST,
    ...overrides,
});

const messageFor = (overrides: Partial<PackageManifest> = {}, applicationId: string = APPLICATION_ID): string =>
    missingDeployError(applicationId, manifestWith(overrides)).message;

const authorMessage = (name: string | null, email: string | null): string =>
    messageFor({ author: { name, email } });

describe("missingDeployError", () => {
    it("returns an error", () => {
        expect(missingDeployError(APPLICATION_ID, EMPTY_MANIFEST)).toBeInstanceOf(Error);
    });

    it("says that the config has no deploy section", () => {
        expect(messageFor()).toContain("no `deploy` section, so there is nothing to package");
    });

    it("names the file the section belongs in", () => {
        expect(messageFor()).toContain("gtkx.config.ts");
    });

    it("asks the reader to adjust the block it prints", () => {
        expect(messageFor()).toContain("Add this to gtkx.config.ts and adjust it:");
    });

    it("says where the values came from", () => {
        expect(messageFor()).toContain("Every value above was derived from package.json");
    });

    it("points at the deploying guide", () => {
        expect(messageFor()).toContain("https://gtkx.dev/guide/deploying");
    });

    it("separates the block from the surrounding prose with blank lines", () => {
        expect(messageFor()).toContain("adjust it:\n\n    deploy: {");
    });
});

describe("missingDeployError block", () => {
    it("opens a deploy block indented by four spaces", () => {
        expect(messageFor()).toContain("\n    deploy: {\n");
    });

    it("closes the deploy block with a trailing comma", () => {
        expect(messageFor()).toContain("\n    },\n");
    });

    it("indents every entry by eight spaces", () => {
        expect(messageFor()).toContain('\n        name: "Tutorial",\n');
    });

    it("prints a summary line", () => {
        expect(messageFor()).toContain("        summary: ");
    });

    it("prints a fixed categories line", () => {
        expect(messageFor()).toContain('        categories: ["Utility"],');
    });

    it("prints a developer line", () => {
        expect(messageFor()).toContain("        developer: { ");
    });

    it("prints a license line", () => {
        expect(messageFor()).toContain("        license: ");
    });

    it("orders the entries as name, summary, categories, developer, license", () => {
        const message = messageFor();
        const order = ["name:", "summary:", "categories:", "developer:", "license:"];
        const positions = order.map((entry) => message.indexOf(entry));
        expect(positions).toEqual(positions.toSorted((left, right) => left - right));
    });
});

describe("missingDeployError manifest values", () => {
    it("takes the name from the package name", () => {
        expect(messageFor({ name: "@gtkx/tasks" })).toContain('name: "@gtkx/tasks",');
    });

    it("takes the summary from the package description", () => {
        expect(messageFor({ description: "Keeps track of tasks" })).toContain('summary: "Keeps track of tasks",');
    });

    it("takes the license from the package license", () => {
        expect(messageFor({ license: "MPL-2.0" })).toContain('license: "MPL-2.0",');
    });

    it("takes the developer name from the package author", () => {
        expect(authorMessage("GTKX", null)).toContain('developer: { name: "GTKX" },');
    });

    it("adds the email when the package author has one", () => {
        expect(authorMessage("GTKX", "hello@gtkx.dev")).toContain(
            'developer: { name: "GTKX", email: "hello@gtkx.dev" },',
        );
    });

    it("omits the email when the package author has none", () => {
        expect(authorMessage("GTKX", null)).not.toContain("email:");
    });

    it("pairs a default name with an email that has no name beside it", () => {
        expect(authorMessage(null, "hello@gtkx.dev")).toContain(
            'developer: { name: "Your Name", email: "hello@gtkx.dev" },',
        );
    });

    it("escapes a value that contains a quote", () => {
        expect(messageFor({ description: 'A "quoted" app' })).toContain(String.raw`summary: "A \"quoted\" app",`);
    });
});

describe("missingDeployError fallbacks", () => {
    it("title-cases the last application id segment when there is no package name", () => {
        expect(messageFor()).toContain('name: "Tutorial",');
    });

    it("title-cases a single-segment application id", () => {
        expect(messageFor({}, "tasks")).toContain('name: "Tasks",');
    });

    it("leaves an already capitalized segment alone", () => {
        expect(messageFor({}, "com.gtkx.Tasks")).toContain('name: "Tasks",');
    });

    it("describes what the summary should be when there is no description", () => {
        expect(messageFor()).toContain('summary: "What the app does, in one line",');
    });

    it("falls back to a placeholder developer name", () => {
        expect(messageFor()).toContain('developer: { name: "Your Name" },');
    });

    it("falls back to MIT for the license", () => {
        expect(messageFor()).toContain('license: "MIT",');
    });

    it("never prints undefined for an empty manifest", () => {
        expect(messageFor()).not.toContain("undefined");
    });

    it("never prints null for an empty manifest", () => {
        expect(messageFor()).not.toContain("null");
    });
});
