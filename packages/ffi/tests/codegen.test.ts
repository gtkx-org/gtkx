import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const generatedDir = resolve(__dirname, "../src/generated");

interface UnknownTypeLocation {
    file: string;
    line: number;
    context: string;
    type: "return" | "parameter";
}

const getAllGeneratedFiles = (dir: string): string[] => {
    const files: string[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            files.push(...getAllGeneratedFiles(fullPath));
        } else if (entry.endsWith(".ts") && entry !== "index.ts" && entry !== "enums.ts") {
            files.push(fullPath);
        }
    }

    return files;
};

const findUnknownTypes = (filePath: string): UnknownTypeLocation[] => {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const locations: UnknownTypeLocation[] = [];
    const relativePath = filePath.replace(`${generatedDir}/`, "");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const lineNum = i + 1;

        const methodReturnMatch = line.match(/^\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*:\s*unknown\s*[{;]/);
        if (methodReturnMatch) {
            locations.push({
                file: relativePath,
                line: lineNum,
                context: line.trim(),
                type: "return",
            });
        }

        const functionReturnMatch = line.match(
            /^export\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*:\s*unknown\s*[{;]/,
        );
        if (functionReturnMatch) {
            locations.push({
                file: relativePath,
                line: lineNum,
                context: line.trim(),
                type: "return",
            });
        }

        const paramUnknownMatch = line.match(/(\w+)\s*:\s*unknown(?:\s*[,)])/g);
        if (paramUnknownMatch && !line.includes("...args: unknown[]")) {
            const isMethodOrFunction =
                line.includes("(") &&
                (line.match(/^\s*(?:static\s+)?(?:async\s+)?\w+\s*\(/) ||
                    line.match(/^export\s+(?:async\s+)?function\s+\w+\s*\(/));

            if (isMethodOrFunction) {
                for (const match of paramUnknownMatch) {
                    const paramName = match.match(/(\w+)\s*:/)?.[1];
                    if (paramName && !paramName.startsWith("_")) {
                        locations.push({
                            file: relativePath,
                            line: lineNum,
                            context: line.trim(),
                            type: "parameter",
                        });
                        break;
                    }
                }
            }
        }
    }

    return locations;
};

const findUnknownArrayTypes = (filePath: string): UnknownTypeLocation[] => {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const locations: UnknownTypeLocation[] = [];
    const relativePath = filePath.replace(`${generatedDir}/`, "");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const lineNum = i + 1;

        if (
            line.includes("): unknown[]") &&
            !line.includes("...args: unknown[]") &&
            !line.includes("handler: (...args: unknown[])") &&
            !line.includes("wrappedHandler")
        ) {
            const isMethodOrFunction =
                line.match(/^\s*(?:static\s+)?(?:async\s+)?\w+\s*\(/) ||
                line.match(/^export\s+(?:async\s+)?function\s+\w+\s*\(/);

            if (isMethodOrFunction) {
                locations.push({
                    file: relativePath,
                    line: lineNum,
                    context: line.trim(),
                    type: "return",
                });
            }
        }
    }

    return locations;
};

describe("Generated FFI Types Quality", () => {
    const allFiles = getAllGeneratedFiles(generatedDir);

    describe("No unknown return types", () => {
        it("should have no public methods with unknown return type", () => {
            const allUnknownReturns: UnknownTypeLocation[] = [];

            for (const file of allFiles) {
                const unknowns = findUnknownTypes(file).filter((u) => u.type === "return");
                allUnknownReturns.push(...unknowns);
            }

            if (allUnknownReturns.length > 0) {
                const summary = allUnknownReturns
                    .slice(0, 20)
                    .map((u) => `  ${u.file}:${u.line} - ${u.context}`)
                    .join("\n");
                const extra = allUnknownReturns.length > 20 ? `\n  ... and ${allUnknownReturns.length - 20} more` : "";

                expect.fail(
                    `Found ${allUnknownReturns.length} methods/functions with unknown return type:\n${summary}${extra}`,
                );
            }
        });

        it("should have no unknown[] return types", () => {
            const allUnknownArrays: UnknownTypeLocation[] = [];

            for (const file of allFiles) {
                const unknowns = findUnknownArrayTypes(file);
                allUnknownArrays.push(...unknowns);
            }

            if (allUnknownArrays.length > 0) {
                const summary = allUnknownArrays
                    .slice(0, 20)
                    .map((u) => `  ${u.file}:${u.line} - ${u.context}`)
                    .join("\n");
                expect.fail(`Found ${allUnknownArrays.length} methods with unknown[] return type:\n${summary}`);
            }
        });
    });

    describe("No unknown parameter types", () => {
        it("should not regress on unknown parameter types (baseline: 136)", () => {
            const allUnknownParams: UnknownTypeLocation[] = [];

            for (const file of allFiles) {
                const unknowns = findUnknownTypes(file).filter((u) => u.type === "parameter");
                allUnknownParams.push(...unknowns);
            }

            expect(allUnknownParams.length).toBeLessThanOrEqual(136);
        });
    });

    describe("Generated files statistics", () => {
        it("should have generated files for all major namespaces", () => {
            const namespaces = readdirSync(generatedDir).filter((f) => {
                const stat = statSync(join(generatedDir, f));
                return stat.isDirectory();
            });

            expect(namespaces).toContain("gtk");
            expect(namespaces).toContain("gdk");
            expect(namespaces).toContain("gio");
            expect(namespaces).toContain("glib");
            expect(namespaces).toContain("gobject");
        });

        it("should have a reasonable number of generated files", () => {
            expect(allFiles.length).toBeGreaterThan(100);
        });
    });

    describe("Type consistency checks", () => {
        it("all class files should have a ptr property or extend a class that does", () => {
            let classesWithoutPtr = 0;
            const issues: string[] = [];

            for (const file of allFiles) {
                const content = readFileSync(file, "utf-8");
                const relativePath = file.replace(`${generatedDir}/`, "");

                const hasClass = content.match(/^export class \w+/m);
                if (!hasClass) continue;

                const hasPtr = content.includes("ptr: unknown");
                const hasExtends = content.match(/^export class \w+ extends/m);

                if (!hasPtr && !hasExtends) {
                    classesWithoutPtr++;
                    issues.push(relativePath);
                }
            }

            if (classesWithoutPtr > 0) {
                expect.fail(
                    `Found ${classesWithoutPtr} classes without ptr property and not extending another class:\n  ${issues.slice(0, 10).join("\n  ")}`,
                );
            }
        });

        it("all methods should use call() from @gtkx/native", () => {
            let filesWithoutCall = 0;
            const issues: string[] = [];

            for (const file of allFiles) {
                const content = readFileSync(file, "utf-8");
                const relativePath = file.replace(`${generatedDir}/`, "");

                const hasClass = content.match(/^export class \w+/m);
                if (!hasClass) continue;

                const hasMethods = content.includes("(): ") || content.includes("(");
                const hasCall = content.includes("call(");
                const importsCall = content.includes('from "@gtkx/native"');

                if (hasMethods && !hasCall && !importsCall) {
                    const methodCount = (content.match(/^\s+\w+\([^)]*\).*{/gm) ?? []).length;
                    if (methodCount > 1) {
                        filesWithoutCall++;
                        issues.push(relativePath);
                    }
                }
            }

            expect(filesWithoutCall).toBe(0);
        });
    });
});

describe("Specific namespace quality checks", () => {
    describe("Gtk namespace", () => {
        const gtkDir = join(generatedDir, "gtk");

        it("Button class should have proper types", () => {
            const buttonPath = join(gtkDir, "button.ts");
            const content = readFileSync(buttonPath, "utf-8");

            expect(content).toContain("export class Button");
            expect(content).toContain("extends Widget");
            expect(content).toContain("setLabel(label: string)");
            expect(content).toContain("getLabel(): string");
            expect(content).not.toMatch(/setLabel\([^)]*unknown/);
            expect(content).not.toMatch(/getLabel\(\):\s*unknown/);
        });

        it("Widget class should have proper types", () => {
            const widgetPath = join(gtkDir, "widget.ts");
            const content = readFileSync(widgetPath, "utf-8");

            expect(content).toContain("export class Widget");
            expect(content).toContain("getVisible(): boolean");
            expect(content).toContain("setVisible(visible: boolean)");
        });

        it("Window class should extend Widget", () => {
            const windowPath = join(gtkDir, "window.ts");
            const content = readFileSync(windowPath, "utf-8");

            expect(content).toContain("export class Window");
            expect(content).toContain("extends Widget");
        });
    });

    describe("Gdk namespace", () => {
        const gdkDir = join(generatedDir, "gdk");

        it("RGBA record should have proper field types", () => {
            const rgbaPath = join(gdkDir, "rgba.ts");
            const content = readFileSync(rgbaPath, "utf-8");

            expect(content).toContain("export class RGBA");
            expect(content).toContain("get red(): number");
            expect(content).toContain("get green(): number");
            expect(content).toContain("get blue(): number");
            expect(content).toContain("get alpha(): number");
        });
    });

    describe("GLib namespace", () => {
        const glibDir = join(generatedDir, "glib");

        it("should have Variant class", () => {
            const variantPath = join(glibDir, "variant.ts");
            const content = readFileSync(variantPath, "utf-8");

            expect(content).toContain("export class Variant");
        });
    });
});
