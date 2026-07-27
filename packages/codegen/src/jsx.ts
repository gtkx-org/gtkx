import type { Library } from "./gir/library.js";
import {
    computeJsxFingerprint,
    FINGERPRINT_FILENAME,
    type JsxFingerprintInput,
    jsxStoreFreshness,
} from "./fingerprint.js";
import { type ModuleExport, readBuiltinElements } from "./react/element-config.js";
import { type JsxStoreOptions, writeJsxStore } from "./store/jsx-store.js";
import { generateJsxFiles } from "./store/jsx/pipeline.js";

type RunJsxCodegenOptions = {
    getLibrary: () => Library;
    jsx: JsxStoreOptions;
    giStoreDir: string;
    reactSubexports: string[];
    userComponents: Record<string, ModuleExport>;
    userLazyElements: string[];
    userProps: Record<string, ModuleExport>;
    giRegenerated: boolean;
    force: boolean;
};

type RunJsxCodegenResult = {
    regenerated: boolean;
    intrinsicElementCount: number;
};

/**
 * Generates the `@gtkx/jsx` store, reading the framework's built-in element config from the freshly
 * linked `@gtkx/react` and layering the project's own element config over it. This is the react-importing
 * half of codegen: it must run only after the gi store has been written and linked.
 */
const runJsxCodegen = async (options: RunJsxCodegenOptions): Promise<RunJsxCodegenResult> => {
    const builtin = await readBuiltinElements(options.reactSubexports, options.giStoreDir);
    const components = { ...builtin.components, ...options.userComponents };
    const lazyElements = [...builtin.lazyElements, ...options.userLazyElements];
    const props = { ...builtin.props, ...options.userProps };

    const fingerprintInput: JsxFingerprintInput = {
        reactVersion: options.jsx.version,
        components,
        lazyElements,
        props,
    };

    if (!options.force && !options.giRegenerated) {
        const { fresh, intrinsicElementCount } = jsxStoreFreshness(options.jsx.storeDir, fingerprintInput);

        if (fresh) {
            return { regenerated: false, intrinsicElementCount };
        }
    }

    const { namespaces, metadata, intrinsicElementCount } = generateJsxFiles(options.getLibrary(), {
        reactSubexports: options.reactSubexports,
        components,
        lazyElements,
        props,
    });

    writeJsxStore(options.jsx, namespaces, metadata, {
        relativePath: FINGERPRINT_FILENAME,
        content: `${JSON.stringify(computeJsxFingerprint(fingerprintInput, intrinsicElementCount), null, 2)}\n`,
    });

    return { regenerated: true, intrinsicElementCount };
};

export { runJsxCodegen, type RunJsxCodegenOptions, type RunJsxCodegenResult };
