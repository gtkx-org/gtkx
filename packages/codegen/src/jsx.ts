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
    isGiRegenerated: boolean;
    isForced: boolean;
};

type RunJsxCodegenResult = {
    isRegenerated: boolean;
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

    if (!options.isForced && !options.isGiRegenerated) {
        const { isFresh, intrinsicElementCount } = jsxStoreFreshness(options.jsx.storeDir, fingerprintInput);

        if (isFresh) {
            return { isRegenerated: false, intrinsicElementCount };
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

    return { isRegenerated: true, intrinsicElementCount };
};

export { runJsxCodegen };
