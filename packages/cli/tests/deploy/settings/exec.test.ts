import { describe, expect, it } from "vitest";
import type { DeployConfig } from "../../../src/deploy/types.js";
import { resolveExecToken, resolveFileAssociations, resolveMimeTypes } from "../../../src/deploy/settings/exec.js";

const TEXT_ASSOCIATION = { extension: "txt", mimeType: "text/plain", description: "Plain text" };
const MARKDOWN_ASSOCIATION = { extension: "md", mimeType: "text/markdown" };

const config = (deploy: DeployConfig = {}): DeployConfig => deploy;

describe("resolveExecToken", () => {
    it("gives no token when there is nothing to open", () => {
        expect(resolveExecToken(config())).toBeNull();
    });

    it("gives no token when both lists are empty", () => {
        expect(resolveExecToken(config({ fileAssociations: [], protocols: [] }))).toBeNull();
    });

    it("gives a file list token for file associations alone", () => {
        expect(resolveExecToken(config({ fileAssociations: [TEXT_ASSOCIATION] }))).toBe("%F");
    });

    it("gives a url token for protocols alone", () => {
        expect(resolveExecToken(config({ protocols: ["gtkx"] }))).toBe("%U");
    });

    it("prefers the url token when both are declared", () => {
        const deploy = config({ fileAssociations: [TEXT_ASSOCIATION], protocols: ["gtkx"] });
        expect(resolveExecToken(deploy)).toBe("%U");
    });

    it("takes the file token from mime types on their own", () => {
        expect(resolveExecToken(config({ mimeTypes: ["text/plain"] }))).toBe("%F");
    });
});

describe("resolveMimeTypes", () => {
    it("gives an empty list for an empty config", () => {
        expect(resolveMimeTypes(config())).toEqual([]);
    });

    it("keeps the explicit mime types", () => {
        expect(resolveMimeTypes(config({ mimeTypes: ["text/plain", "text/html"] }))).toEqual([
            "text/plain",
            "text/html",
        ]);
    });

    it("takes the mime type of each file association", () => {
        const deploy = config({ fileAssociations: [TEXT_ASSOCIATION, MARKDOWN_ASSOCIATION] });
        expect(resolveMimeTypes(deploy)).toEqual(["text/plain", "text/markdown"]);
    });

    it("turns each protocol into a scheme handler", () => {
        expect(resolveMimeTypes(config({ protocols: ["gtkx", "tasks"] }))).toEqual([
            "x-scheme-handler/gtkx",
            "x-scheme-handler/tasks",
        ]);
    });
});

describe("resolveMimeTypes — merging", () => {
    it("unions the three sources in order", () => {
        const deploy = config({
            mimeTypes: ["application/json"],
            fileAssociations: [TEXT_ASSOCIATION],
            protocols: ["gtkx"],
        });

        expect(resolveMimeTypes(deploy)).toEqual(["application/json", "text/plain", "x-scheme-handler/gtkx"]);
    });

    it("removes a mime type that an association repeats", () => {
        const deploy = config({ mimeTypes: ["text/plain"], fileAssociations: [TEXT_ASSOCIATION] });
        expect(resolveMimeTypes(deploy)).toEqual(["text/plain"]);
    });

    it("removes duplicates among the file associations themselves", () => {
        const deploy = config({ fileAssociations: [TEXT_ASSOCIATION, { extension: "text", mimeType: "text/plain" }] });
        expect(resolveMimeTypes(deploy)).toEqual(["text/plain"]);
    });

    it("removes a repeated protocol", () => {
        expect(resolveMimeTypes(config({ protocols: ["gtkx", "gtkx"] }))).toEqual(["x-scheme-handler/gtkx"]);
    });

    it("keeps a duplicate at the position it first appeared", () => {
        const deploy = config({
            mimeTypes: ["text/markdown", "application/json"],
            fileAssociations: [TEXT_ASSOCIATION, MARKDOWN_ASSOCIATION],
        });

        expect(resolveMimeTypes(deploy)).toEqual(["text/markdown", "application/json", "text/plain"]);
    });
});

describe("resolveFileAssociations", () => {
    it("gives an empty list for an empty config", () => {
        expect(resolveFileAssociations(config())).toEqual([]);
    });

    it("gives an empty list for an empty array", () => {
        expect(resolveFileAssociations(config({ fileAssociations: [] }))).toEqual([]);
    });

    it("carries the extension, mime type, and description through", () => {
        expect(resolveFileAssociations(config({ fileAssociations: [TEXT_ASSOCIATION] }))).toEqual([
            { extension: "txt", mimeType: "text/plain", description: "Plain text" },
        ]);
    });

    it("maps a missing description to null", () => {
        expect(resolveFileAssociations(config({ fileAssociations: [MARKDOWN_ASSOCIATION] }))).toEqual([
            { extension: "md", mimeType: "text/markdown", description: null },
        ]);
    });

    it("preserves the declared order", () => {
        const deploy = config({ fileAssociations: [MARKDOWN_ASSOCIATION, TEXT_ASSOCIATION] });
        expect(resolveFileAssociations(deploy).map((entry) => entry.extension)).toEqual(["md", "txt"]);
    });
});
