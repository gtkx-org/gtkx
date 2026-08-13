import { describe, expect, it } from "vitest";
import { gtkxAssetImports } from "../../src/vite-plugins/asset-imports.js";

type TransformHook = (code: string, id: string) => void;

const MODULE_ID = "/project/src/app.tsx";
const RELATIVE_PATH_IMPORT = "import { path } from \"./icon.png\";\nconsole.log(path);\n";
const DATA_PATH_IMPORT = "import { path } from \"#data/icons/logo.png\";\nconsole.log(path);\n";

const COMPONENT = [
    "import { path } from \"./icon.png\";",
    "export const Icon = () => <img src={path} />;",
    "",
].join("\n");

const transform = (code: string, id: string = MODULE_ID): void => {
    (gtkxAssetImports().transform as TransformHook)(code, id);
};

describe("gtkxAssetImports (plugin shape)", () => {
    it("checks specifiers as written, before the asset pipeline resolves them", () => {
        const plugin = gtkxAssetImports();
        expect(plugin.name).toBe("gtkx:asset-imports");
        expect(plugin.enforce).toBe("pre");
    });
});

describe("gtkxAssetImports (bindings the bundle cannot back)", () => {
    it("rejects what gtkx build rejects instead of letting gtkx dev bind undefined", () => {
        expect(() => {
            transform(RELATIVE_PATH_IMPORT);
        }).toThrow(/"\.\/icon\.png" does not export "path"/);
    });

    it("names the importing file and the way to get the bundled exports", () => {
        expect(() => {
            transform(RELATIVE_PATH_IMPORT);
        }).toThrow(/^\/project\/src\/app\.tsx: .*staged into the GResource bundle/s);
    });

    it("rejects the same binding re-exported from an unbundled asset", () => {
        expect(() => {
            transform("export { path } from \"./blob.data\";\n");
        }).toThrow(/"\.\/blob\.data" does not export "path"/);
    });

    it("rejects a named import from a data specifier a query sends elsewhere", () => {
        expect(() => {
            transform("import { path } from \"#data/logo.png?url\";\n");
        }).toThrow(/drop the query/);
    });

    it("rejects the binding in a JavaScript project, which has no declarations to catch it", () => {
        expect(() => {
            transform(RELATIVE_PATH_IMPORT, "/project/src/app.js");
        }).toThrow(/does not export "path"/);
    });

    it("rejects the binding in JSX a JavaScript project keeps in a .js file", () => {
        expect(() => {
            transform(COMPONENT, "/project/src/icon.js");
        }).toThrow(/does not export "path"/);
    });
});

describe("gtkxAssetImports (bindings the bundle backs)", () => {
    it("accepts the named import of a data-scoped asset", () => {
        expect(() => {
            transform(DATA_PATH_IMPORT);
        }).not.toThrow();
    });

    it("accepts the default import of a relative asset", () => {
        expect(() => {
            transform("import iconUrl from \"./icon.png\";\nconsole.log(iconUrl);\n");
        }).not.toThrow();
    });

    it("accepts a namespace import, which binds no missing export", () => {
        expect(() => {
            transform("import * as icon from \"./icon.png\";\nconsole.log(icon);\n");
        }).not.toThrow();
    });

    it("accepts a type-only binding, which never reaches the bundle", () => {
        expect(() => {
            transform("import type { path } from \"./icon.png\";\nexport type Path = typeof path;\n");
        }).not.toThrow();
    });

    it("accepts a re-exported default", () => {
        expect(() => {
            transform("export { default as iconUrl } from \"./icon.png\";\n");
        }).not.toThrow();
    });

    it("accepts a module that only mentions an asset extension", () => {
        expect(() => {
            transform("export const name = \"icon.png\";\n");
        }).not.toThrow();
    });
});

describe("gtkxAssetImports (checked sources)", () => {
    it("leaves dependencies to the bundler that already rejects them", () => {
        expect(() => {
            transform(RELATIVE_PATH_IMPORT, "/project/node_modules/pkg/index.js");
        }).not.toThrow();
    });

    it("leaves virtual modules alone", () => {
        expect(() => {
            transform(RELATIVE_PATH_IMPORT, "\0gtkx-resources:/project/src/icon.png");
        }).not.toThrow();
    });

    it("leaves ids that are not JavaScript or TypeScript sources alone", () => {
        expect(() => {
            transform(RELATIVE_PATH_IMPORT, "/project/src/styles.css");
        }).not.toThrow();
    });

    it("leaves a source that does not parse to the transform that reports the syntax error", () => {
        expect(() => {
            transform("import { path } from \"./icon.png\"\nconst = ;\n", "/project/src/broken.ts");
        }).not.toThrow();
    });
});
