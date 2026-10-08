import { errorMessage } from "@gtkx/utils";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { parseSync } from "oxc-parser";
import type { OxcError, transformSync } from "oxc-transform";
import type { DiagnosedFile, SourceModule } from "../compile.js";

type NativeTranspiler = { transform: typeof transformSync; parse: typeof parseSync };

const require = createRequire(import.meta.url);
let nativeTranspiler: NativeTranspiler | null | undefined;

const loadNativeTranspiler = (): NativeTranspiler | undefined => {
    if (nativeTranspiler === undefined) {
        try {
            const transformer = require("oxc-transform") as typeof import("oxc-transform");
            const parser = require("oxc-parser") as typeof import("oxc-parser");
            nativeTranspiler = { transform: transformer.transformSync, parse: parser.parseSync };
        } catch (error) {
            if (!errorMessage(error).startsWith("Cannot find native binding.")) {
                throw error;
            }

            nativeTranspiler = null;
            console.warn("Native store transpilation is unavailable; using TypeScript instead.");
        }
    }

    return nativeTranspiler ?? undefined;
};

const extension = (fileName: string, suffix: string): string => fileName.replace(/\.tsx?$/u, suffix);

const diagnose = (
    module: SourceModule,
    error: Pick<OxcError, "labels" | "message" | "helpMessage">,
    offsetEncoding: "utf8" | "utf16",
): DiagnosedFile => {
    const offset = error.labels[0]?.start;
    const prefix =
        offset === undefined
            ? undefined
            : offsetEncoding === "utf8"
              ? Buffer.from(module.source).subarray(0, offset).toString()
              : module.source.slice(0, offset);
    const lines = prefix?.split(/\r\n|[\r\n\u2028\u2029]/u);
    const location = lines === undefined ? "" : `:${String(lines.length)}:${String((lines.at(-1)?.length ?? 0) + 1)}`;
    const help = error.helpMessage === null ? "" : `\n${error.helpMessage}`;

    return { fileName: module.fileName, text: `${module.fileName}${location} - ${error.message}${help}` };
};

const javascriptWithoutComments = (code: string, comments: ReturnType<typeof parseSync>["comments"]): string => {
    const parts: string[] = [];
    let cursor = 0;

    for (const comment of comments) {
        if (/^\s*[@#]__PURE__\s*$/u.test(comment.value)) {
            continue;
        }

        const removed = code.slice(comment.start, comment.end);
        parts.push(code.slice(cursor, comment.start), /[\r\n\u2028\u2029]/u.test(removed) ? "\n" : " ");
        cursor = comment.end;
    }

    parts.push(code.slice(cursor));

    return parts.join("");
};

const transpileModules = (params: { projectDir: string; files: SourceModule[] }): DiagnosedFile[] | undefined => {
    const transpiler = loadNativeTranspiler();

    if (transpiler === undefined) {
        return undefined;
    }

    const diagnosed: DiagnosedFile[] = [];

    for (const module of params.files) {
        const transformed = transpiler.transform(module.fileName, module.source, {
            target: "esnext",
            sourceType: "module",
            jsx: { runtime: "automatic", importSource: "react" },
            typescript: { rewriteImportExtensions: "rewrite", declaration: { stripInternal: false } },
        });

        if (transformed.errors.length > 0) {
            diagnosed.push(...transformed.errors.map((error) => diagnose(module, error, "utf8")));
            continue;
        }

        if (transformed.declaration === undefined) {
            throw new Error(`No declaration was emitted for ${module.fileName}`);
        }

        const javascript = { fileName: extension(module.fileName, ".js"), source: transformed.code };
        const parsed = transpiler.parse(javascript.fileName, javascript.source, { sourceType: "module" });

        if (parsed.errors.length > 0) {
            writeFileSync(join(params.projectDir, javascript.fileName), transformed.code);
            diagnosed.push(
                ...parsed.errors.map((error) => ({
                    ...diagnose(javascript, error, "utf16"),
                    fileName: module.fileName,
                })),
            );
            continue;
        }

        writeFileSync(join(params.projectDir, extension(module.fileName, ".d.ts")), transformed.declaration);
        writeFileSync(
            join(params.projectDir, javascript.fileName),
            javascriptWithoutComments(transformed.code, parsed.comments),
        );
    }

    return diagnosed;
};

export { transpileModules };
