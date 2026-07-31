import type { Library } from "./gir/library.js";
import type { StoreOptions } from "./store/store-fs.js";
import {
    computeJsxFingerprint,
    FINGERPRINT_FILENAME,
    type JsxFingerprintInput,
    jsxStoreFreshness,
} from "./fingerprint.js";
import { type ModuleExport, readBuiltinElements } from "./react/element-config.js";
import { writeJsxStore } from "./store/jsx-store.js";
import { ELEMENTS_FILENAME, renderGeneratedElements } from "./store/jsx/generated-elements.js";
import { mergeOmittedProps, type OmittedProps } from "./store/jsx/omitted-props.js";
import { generateJsxFiles } from "./store/jsx/pipeline.js";

type RunJsxCodegenOptions = {
    getLibrary: () => Library;
    jsx: StoreOptions;
    giStoreDir: string;
    reactSubexports: string[];
    userComponents: Record<string, ModuleExport>;
    userLazyElements: string[];
    userProps: Record<string, ModuleExport>;
    userOmittedProps: OmittedProps;
    giRegenerated: boolean;
    force: boolean;
};

type RunJsxCodegenResult = {
    regenerated: boolean;
    intrinsicElementCount: number;
};

const runJsxCodegen = async (options: RunJsxCodegenOptions): Promise<RunJsxCodegenResult> => {
    const builtin = await readBuiltinElements(options.reactSubexports, options.giStoreDir);
    const components = { ...builtin.components, ...options.userComponents };
    const lazyElements = [...builtin.lazyElements, ...options.userLazyElements];
    const props = { ...builtin.props, ...options.userProps };
    const omittedProps = mergeOmittedProps(builtin.omittedProps, options.userOmittedProps);

    const fingerprintInput: JsxFingerprintInput = {
        reactVersion: options.jsx.version,
        components,
        lazyElements,
        props,
        omittedProps,
    };

    if (!options.force && !options.giRegenerated) {
        const { fresh, intrinsicElementCount } = jsxStoreFreshness(options.jsx.storeDir, fingerprintInput);

        if (fresh) {
            return { regenerated: false, intrinsicElementCount };
        }
    }

    const { namespaces, metadata, intrinsicElementCount, elements } = generateJsxFiles(options.getLibrary(), {
        reactSubexports: options.reactSubexports,
        components,
        lazyElements,
        props,
        omittedProps,
    });

    writeJsxStore(options.jsx, namespaces, metadata, [
        {
            relativePath: FINGERPRINT_FILENAME,
            content: `${JSON.stringify(computeJsxFingerprint(fingerprintInput, intrinsicElementCount), null, 2)}\n`,
        },
        { relativePath: ELEMENTS_FILENAME, content: renderGeneratedElements(elements) },
    ]);

    return { regenerated: true, intrinsicElementCount };
};

export { runJsxCodegen, type RunJsxCodegenOptions, type RunJsxCodegenResult };
