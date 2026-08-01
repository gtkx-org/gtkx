import { describe, expect, it } from "vitest";
import { listTemplates, renderFile, type TemplateContext } from "../src/templates.js";

const baseContext: TemplateContext = context();

function context(overrides: Partial<TemplateContext> = {}): TemplateContext {
    return {
        name: "my-app",
        applicationId: "com.example.MyApp",
        title: "My App",
        shouldIncludeTesting: false,
        isTypescript: true,
        importExtension: ".js",
        ...overrides,
    };
}

describe("renderFile", () => {
    it("renders the package.json template with the project name", async () => {
        const output = await renderFile("package.json", baseContext);
        expect(output).toContain('"name": "my-app"');
    });

    it("renders the gtkx.config.ts template", async () => {
        const output = await renderFile("gtkx.config.ts", baseContext);
        expect(output).toContain("defineConfig");
        expect(output).toContain("Gtk-4.0");
        expect(output).toContain('applicationId: "com.example.MyApp"');
    });

    it("substitutes the title placeholder into the app template", async () => {
        const output = await renderFile("src/app.tsx", baseContext);
        expect(output).toContain('title="My App"');
    });

    it("leaves the package.json template free of a test script", async () => {
        const output = await renderFile("package.json", { ...baseContext, shouldIncludeTesting: true });
        expect(output).not.toContain("vitest");
    });

    it("propagates the applicationId and title to templates that use them", async () => {
        const output = await renderFile(".gitignore", baseContext);
        expect(typeof output).toBe("string");
    });

    it("includes the typecheck script only for the TypeScript variant", async () => {
        expect(await renderFile("package.json", context({ isTypescript: true }))).toContain('"typecheck"');
        expect(await renderFile("package.json", context({ isTypescript: false }))).not.toContain('"typecheck"');
    });

    it("targets the language-specific test glob in vitest.config", async () => {
        expect(await renderFile("vitest.config.ts", context({ isTypescript: true }))).toContain("{ts,tsx}");
        expect(await renderFile("vitest.config.ts", context({ isTypescript: false }))).toContain("{js,jsx}");
    });

    it("declares node and react types without the dom lib", async () => {
        const tsconfig = JSON.parse(await renderFile("tsconfig.json", baseContext)) as { compilerOptions: unknown };
        expect(tsconfig.compilerOptions).toMatchObject({ lib: ["esnext"], types: ["node", "react"] });
    });

    it("uses the import extension for the entry and test imports", async () => {
        expect(await renderFile("src/index.tsx", context({ importExtension: ".js" }))).toContain('from "./app.js"');
        expect(await renderFile("src/index.tsx", context({ importExtension: ".jsx" }))).toContain('from "./app.jsx"');

        expect(await renderFile("tests/app.test.tsx", context({ importExtension: ".jsx" }))).toContain(
            'from "../src/app.jsx"',
        );
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

    it("returns paths every entry of which renderFile resolves", async () => {
        for (const template of listTemplates()) {
            expect(typeof await renderFile(template, baseContext)).toBe("string");
        }
    });
});
