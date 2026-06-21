import { describe, expect, it } from "vitest";
import { ASSET_EXTENSIONS, renderAssetEnvModule } from "../../src/vite-plugins/asset-extensions.js";

describe("renderAssetEnvModule", () => {
    it("renders a declare-module block per extension", () => {
        const out = renderAssetEnvModule(["png", "svg"]);
        expect(out).toContain('declare module "*.png" {');
        expect(out).toContain('declare module "*.svg" {');
    });

    it("emits the resourceUri/path/default body for each extension", () => {
        const out = renderAssetEnvModule(["png"]);
        expect(out).toBe(
            [
                'declare module "*.png" {',
                "    const resourceUri: string;",
                "    export const path: string;",
                "    export default resourceUri;",
                "}",
            ].join("\n"),
        );
    });

    it("separates consecutive blocks with a blank line", () => {
        const out = renderAssetEnvModule(["png", "svg"]);
        expect(out).toContain("}\n\ndeclare module");
    });

    it("covers every extension in the source-of-truth list", () => {
        const out = renderAssetEnvModule(ASSET_EXTENSIONS);
        for (const extension of ASSET_EXTENSIONS) {
            expect(out).toContain(`declare module "*.${extension}" {`);
        }
    });
});
