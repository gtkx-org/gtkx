import { describe, expect, it } from "vitest";
import { renderInitModule } from "../../src/gresources/render.js";

describe("renderInitModule", () => {
    it("renders the build-mode registrar that loads the bundle next to itself", () => {
        const source = renderInitModule({ isBuild: true, devBundlePath: "" });

        expect(source).toContain("fileURLToPath(import.meta.url)");
        expect(source).toContain("resourceLoad(join(bundleDir,");
        expect(source).toContain("resourcesRegister(resource)");
        expect(source).toContain("export function ensureRegistered()");
        expect(source).toContain("export function __refresh()");
    });

    it("renders the dev-mode registrar that re-registers a staged bundle on change", () => {
        const source = renderInitModule({ isBuild: false, devBundlePath: "/tmp/staged/gtkx.gresource" });

        expect(source).toContain(JSON.stringify("/tmp/staged/gtkx.gresource"));
        expect(source).toContain("resourcesUnregister(current)");
        expect(source).toContain("statSync(");
        expect(source).toContain("export function ensureRegistered()");
        expect(source).toContain("export function __refresh()");
    });
});
