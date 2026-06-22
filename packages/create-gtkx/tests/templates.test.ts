import { describe, expect, it } from "vitest";
import { listTemplates, renderFile, type TemplateContext } from "../src/templates.js";

const baseContext: TemplateContext = {
    name: "my-app",
    applicationId: "com.example.MyApp",
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
        expect(output).toContain('applicationId: "com.example.MyApp"');
    });

    it("includes vitest hooks when testing is 'vitest'", () => {
        const output = renderFile("package.json.ejs", { ...baseContext, testing: "vitest" });
        expect(output).toContain("vitest");
    });

    it("omits vitest hooks when testing is 'none'", () => {
        const output = renderFile("package.json.ejs", { ...baseContext, testing: "none" });
        expect(output).not.toContain("vitest");
    });

    it("propagates the applicationId and title to templates that use them", () => {
        const output = renderFile("gitignore.ejs", baseContext);
        expect(typeof output).toBe("string");
    });
});

describe("listTemplates", () => {
    it("lists every .ejs template with forward-slashed relative paths, sorted", () => {
        const templates = listTemplates();

        expect(templates).toEqual([
            "config/vitest.config.ts.ejs",
            "gitignore.ejs",
            "gtkx.config.ts.ejs",
            "package.json.ejs",
            "src/app.tsx.ejs",
            "src/gtkx-env.d.ts.ejs",
            "src/index.tsx.ejs",
            "tests/app.test.tsx.ejs",
            "tsconfig.json.ejs",
        ]);
    });

    it("returns paths every entry of which renderFile resolves", () => {
        for (const template of listTemplates()) {
            expect(typeof renderFile(template, baseContext)).toBe("string");
        }
    });
});
