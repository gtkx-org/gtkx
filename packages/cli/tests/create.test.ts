import { describe, expect, it } from "vitest";
import {
    generatePackageJson,
    generateTsConfig,
    getAddCommand,
    getRunCommand,
    getTestScript,
    isValidAppId,
    isValidProjectName,
    type PackageManager,
} from "../src/create.js";

describe("isValidProjectName", () => {
    it("accepts lowercase letters", () => {
        expect(isValidProjectName("myapp")).toBe(true);
    });

    it("accepts numbers", () => {
        expect(isValidProjectName("app123")).toBe(true);
    });

    it("accepts hyphens", () => {
        expect(isValidProjectName("my-app")).toBe(true);
    });

    it("accepts combination of lowercase, numbers, and hyphens", () => {
        expect(isValidProjectName("my-app-123")).toBe(true);
    });

    it("rejects uppercase letters", () => {
        expect(isValidProjectName("MyApp")).toBe(false);
    });

    it("rejects spaces", () => {
        expect(isValidProjectName("my app")).toBe(false);
    });

    it("rejects underscores", () => {
        expect(isValidProjectName("my_app")).toBe(false);
    });

    it("rejects special characters", () => {
        expect(isValidProjectName("my@app")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(isValidProjectName("")).toBe(false);
    });
});

describe("isValidAppId", () => {
    it("accepts valid reverse domain notation", () => {
        expect(isValidAppId("com.example.myapp")).toBe(true);
    });

    it("accepts org prefix", () => {
        expect(isValidAppId("org.gtkx.myapp")).toBe(true);
    });

    it("accepts multiple segments", () => {
        expect(isValidAppId("com.example.company.myapp")).toBe(true);
    });

    it("accepts segments with numbers", () => {
        expect(isValidAppId("com.example123.myapp")).toBe(true);
    });

    it("rejects single segment", () => {
        expect(isValidAppId("myapp")).toBe(false);
    });

    it("rejects starting with number", () => {
        expect(isValidAppId("123.example.myapp")).toBe(false);
    });

    it("rejects segment starting with number", () => {
        expect(isValidAppId("com.123example.myapp")).toBe(false);
    });

    it("rejects hyphens in segments", () => {
        expect(isValidAppId("com.my-example.myapp")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(isValidAppId("")).toBe(false);
    });

    it("rejects trailing dot", () => {
        expect(isValidAppId("com.example.")).toBe(false);
    });
});

describe("getTestScript", () => {
    it("returns vitest script for vitest", () => {
        expect(getTestScript("vitest")).toBe("GDK_BACKEND=x11 xvfb-run -a vitest");
    });

    it("returns jest script for jest", () => {
        expect(getTestScript("jest")).toBe("GDK_BACKEND=x11 xvfb-run -a jest");
    });

    it("returns node test runner script for node", () => {
        expect(getTestScript("node")).toBe("GDK_BACKEND=x11 xvfb-run -a node --import tsx --test tests/**/*.test.ts");
    });

    it("returns undefined for none", () => {
        expect(getTestScript("none")).toBeUndefined();
    });
});

describe("generatePackageJson", () => {
    it("generates valid JSON", () => {
        const result = generatePackageJson("my-app", "com.example.myapp", "vitest");
        expect(() => JSON.parse(result)).not.toThrow();
    });

    it("includes project name", () => {
        const result = JSON.parse(generatePackageJson("my-app", "com.example.myapp", "vitest"));
        expect(result.name).toBe("my-app");
    });

    it("includes app ID in gtkx config", () => {
        const result = JSON.parse(generatePackageJson("my-app", "com.example.myapp", "vitest"));
        expect(result.gtkx.appId).toBe("com.example.myapp");
    });

    it("includes test script when testing framework is selected", () => {
        const result = JSON.parse(generatePackageJson("my-app", "com.example.myapp", "vitest"));
        expect(result.scripts.test).toBeDefined();
    });

    it("does not include test script when testing is none", () => {
        const result = JSON.parse(generatePackageJson("my-app", "com.example.myapp", "none"));
        expect(result.scripts.test).toBeUndefined();
    });

    it("includes dev script", () => {
        const result = JSON.parse(generatePackageJson("my-app", "com.example.myapp", "vitest"));
        expect(result.scripts.dev).toBe("gtkx dev src/app.tsx");
    });

    it("includes build script", () => {
        const result = JSON.parse(generatePackageJson("my-app", "com.example.myapp", "vitest"));
        expect(result.scripts.build).toBe("tsc -b");
    });
});

describe("generateTsConfig", () => {
    it("generates valid JSON", () => {
        const result = generateTsConfig();
        expect(() => JSON.parse(result)).not.toThrow();
    });

    it("sets target to ESNext", () => {
        const result = JSON.parse(generateTsConfig());
        expect(result.compilerOptions.target).toBe("ESNext");
    });

    it("sets module to NodeNext", () => {
        const result = JSON.parse(generateTsConfig());
        expect(result.compilerOptions.module).toBe("NodeNext");
    });

    it("enables strict mode", () => {
        const result = JSON.parse(generateTsConfig());
        expect(result.compilerOptions.strict).toBe(true);
    });

    it("sets jsx to react-jsx", () => {
        const result = JSON.parse(generateTsConfig());
        expect(result.compilerOptions.jsx).toBe("react-jsx");
    });
});

describe("getAddCommand", () => {
    const packages = ["react", "typescript"];

    describe("pnpm", () => {
        it("generates correct add command", () => {
            expect(getAddCommand("pnpm", packages, false)).toContain("pnpm add");
            expect(getAddCommand("pnpm", packages, false)).toContain("react");
            expect(getAddCommand("pnpm", packages, false)).toContain("typescript");
        });

        it("generates correct dev add command", () => {
            expect(getAddCommand("pnpm", packages, true)).toBe("pnpm add -D react typescript");
        });
    });

    describe("npm", () => {
        it("generates correct add command", () => {
            expect(getAddCommand("npm", packages, false)).toContain("npm install");
            expect(getAddCommand("npm", packages, false)).toContain("react");
            expect(getAddCommand("npm", packages, false)).toContain("typescript");
        });

        it("generates correct dev add command", () => {
            expect(getAddCommand("npm", packages, true)).toBe("npm install --save-dev react typescript");
        });
    });

    describe("yarn", () => {
        it("generates correct add command", () => {
            expect(getAddCommand("yarn", packages, false)).toContain("yarn add");
            expect(getAddCommand("yarn", packages, false)).toContain("react");
            expect(getAddCommand("yarn", packages, false)).toContain("typescript");
        });

        it("generates correct dev add command", () => {
            expect(getAddCommand("yarn", packages, true)).toBe("yarn add -D react typescript");
        });
    });

    describe("bun", () => {
        it("generates correct add command", () => {
            expect(getAddCommand("bun", packages, false)).toContain("bun add");
            expect(getAddCommand("bun", packages, false)).toContain("react");
            expect(getAddCommand("bun", packages, false)).toContain("typescript");
        });

        it("generates correct dev add command", () => {
            expect(getAddCommand("bun", packages, true)).toBe("bun add -D react typescript");
        });
    });

    it("handles empty package list", () => {
        const result = getAddCommand("pnpm", [], false);
        expect(result).toContain("pnpm add");
    });

    it("handles single package", () => {
        const result = getAddCommand("pnpm", ["react"], false);
        expect(result).toContain("pnpm add");
        expect(result).toContain("react");
    });
});

describe("getRunCommand", () => {
    it("returns npm run dev for npm", () => {
        expect(getRunCommand("npm")).toBe("npm run dev");
    });

    it("returns yarn dev for yarn", () => {
        expect(getRunCommand("yarn")).toBe("yarn dev");
    });

    it("returns pnpm dev for pnpm", () => {
        expect(getRunCommand("pnpm")).toBe("pnpm dev");
    });

    it("returns bun dev for bun", () => {
        expect(getRunCommand("bun")).toBe("bun dev");
    });

    it("handles all package managers", () => {
        const packageManagers: PackageManager[] = ["npm", "yarn", "pnpm", "bun"];
        for (const pm of packageManagers) {
            expect(getRunCommand(pm)).toBeDefined();
        }
    });
});
