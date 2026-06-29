import { describe, expect, it } from "vitest";
import { listTemplates, renderFile, type TemplateContext } from "../src/templates.js";

const baseContext: TemplateContext = {
    name: "my-app",
    applicationId: "com.example.MyApp",
    title: "My App",
    includeTesting: false,
};

describe("renderFile", () => {
    it("renders the package.json template with the project name", () => {
        const output = renderFile("package.json", baseContext);
        expect(output).toContain('"name": "my-app"');
    });

    it("renders the gtkx.config.ts template", () => {
        const output = renderFile("gtkx.config.ts", baseContext);
        expect(output).toContain("defineConfig");
        expect(output).toContain("Gtk-4.0");
        expect(output).toContain('applicationId: "com.example.MyApp"');
    });

    it("substitutes the title placeholder into the app template", () => {
        const output = renderFile("src/app.tsx", baseContext);
        expect(output).toContain('title="My App"');
    });

    it("leaves the package.json template free of a test script", () => {
        const output = renderFile("package.json", { ...baseContext, includeTesting: true });
        expect(output).not.toContain("vitest");
    });

    it("propagates the applicationId and title to templates that use them", () => {
        const output = renderFile(".gitignore", baseContext);
        expect(typeof output).toBe("string");
    });
});

describe("listTemplates", () => {
    it("lists every template with forward-slashed relative paths, sorted", () => {
        const templates = listTemplates();

        expect(templates).toEqual([
            ".gitignore",
            "gtkx.config.ts",
            "package.json",
            "src/app.tsx",
            "src/gtkx-env.d.ts",
            "src/index.tsx",
            "tests/app.test.tsx",
            "tsconfig.json",
            "vitest.config.ts",
        ]);
    });

    it("returns paths every entry of which renderFile resolves", () => {
        for (const template of listTemplates()) {
            expect(typeof renderFile(template, baseContext)).toBe("string");
        }
    });
});
