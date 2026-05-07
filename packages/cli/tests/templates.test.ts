import { describe, expect, it } from "vitest";
import { renderFile, type TemplateContext } from "../src/templates.js";

const baseContext: TemplateContext = {
    name: "my-app",
    appId: "com.example.MyApp",
    title: "My App",
    testing: "none",
};

describe("renderFile", () => {
    it("renders the package.json template with the project name", () => {
        const output = renderFile("package.json.ejs", baseContext);
        expect(output).toContain('"name": "my-app"');
    });

    it("renders the gtkx.config.ts template", () => {
        const output = renderFile("gtkx.config.ts.ejs", baseContext);
        expect(output).toContain("defineConfig");
        expect(output).toContain("Gtk-4.0");
    });

    it("includes vitest hooks when testing is 'vitest'", () => {
        const output = renderFile("package.json.ejs", { ...baseContext, testing: "vitest" });
        expect(output).toContain("vitest");
    });

    it("omits vitest hooks when testing is 'none'", () => {
        const output = renderFile("package.json.ejs", { ...baseContext, testing: "none" });
        expect(output).not.toContain("vitest");
    });

    it("propagates the appId and title to templates that use them", () => {
        const output = renderFile("gitignore.ejs", baseContext);
        expect(typeof output).toBe("string");
    });
});
