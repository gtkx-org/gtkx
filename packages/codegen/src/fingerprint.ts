import { sortStrings } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/** The freshness sentinel of the `@gtkx/gi` store, derived purely from the GIR inputs. */
type GiFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
};

type ModuleExport = { module: string; export: string };

/** The `@gtkx/react` element config that shapes the generated `@gtkx/jsx` store. */
type JsxFingerprintInput = {
    reactVersion: string;
    components: Record<string, ModuleExport>;
    lazyElements: string[];
    props: Record<string, ModuleExport>;
};

/** The freshness sentinel of the `@gtkx/jsx` store, derived from the React element config. */
type JsxFingerprint = {
    value: string;
    intrinsicElementCount: number;
};

const require = createRequire(import.meta.url);
const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";
const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

const sortAlpha = (values: string[]): string => sortStrings(values).join(",");

const hashGi = (girFiles: string[], libraries: string[]): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(sortAlpha(libraries));

    for (const file of sortStrings(girFiles)) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }

    return hash.digest("hex");
};

const computeGiFingerprint = (girFiles: string[], libraries: string[]): GiFingerprint => ({
    value: hashGi(girFiles, libraries),
    girFiles,
    libraries,
});

const isGiStoreFresh = (giStoreDir: string, libraries: string[]): boolean => {
    const sentinelPath = join(giStoreDir, FINGERPRINT_FILENAME);

    if (!existsSync(sentinelPath)) {
        return false;
    }

    let sentinel: GiFingerprint;

    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as GiFingerprint;
    } catch {
        return false;
    }

    if (sortAlpha(sentinel.libraries) !== sortAlpha(libraries)) {
        return false;
    }

    try {
        return hashGi(sentinel.girFiles, sentinel.libraries) === sentinel.value;
    } catch {
        return false;
    }
};

const serializeModuleExports = (map: Record<string, ModuleExport>): [string, string, string][] =>
    sortStrings(Object.keys(map)).map((type) => [type, map[type]?.module ?? "", map[type]?.export ?? ""]);

const hashJsx = (input: JsxFingerprintInput): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                CODEGEN_VERSION,
                input.reactVersion,
                serializeModuleExports(input.components),
                sortStrings(input.lazyElements),
                serializeModuleExports(input.props),
            ]),
        )
        .digest("hex");

const computeJsxFingerprint = (input: JsxFingerprintInput, intrinsicElementCount: number): JsxFingerprint => ({
    value: hashJsx(input),
    intrinsicElementCount,
});

const isJsxStoreFresh = (
    jsxStoreDir: string,
    input: JsxFingerprintInput,
): { fresh: boolean; intrinsicElementCount: number } => {
    const sentinelPath = join(jsxStoreDir, FINGERPRINT_FILENAME);

    if (!existsSync(sentinelPath)) {
        return { fresh: false, intrinsicElementCount: 0 };
    }

    let sentinel: JsxFingerprint;

    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as JsxFingerprint;
    } catch {
        return { fresh: false, intrinsicElementCount: 0 };
    }

    return sentinel.value === hashJsx(input)
        ? { fresh: true, intrinsicElementCount: sentinel.intrinsicElementCount }
        : { fresh: false, intrinsicElementCount: 0 };
};

export {
    FINGERPRINT_FILENAME,
    computeGiFingerprint,
    isGiStoreFresh,
    computeJsxFingerprint,
    isJsxStoreFresh,
    type GiFingerprint,
    type JsxFingerprintInput,
    type JsxFingerprint,
};
