import type { Config } from "@gtkx/config";
import { mergeOmittedProps } from "@gtkx/codegen";
import { readBuiltinElementsForDocs, removeDocs, writeDocs } from "@gtkx/codegen/internal";
import {
    resolveAcceptedChildTypes,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "@gtkx/config/internal";
import { join } from "node:path";

type WriteReferenceOptions = {
    root: string;
    config: Config;
    girPath: string[];
    libraries: string[];
    declarationDir: string;
    isEnabled: boolean;
    isForced?: boolean;
};

type ReferenceResult = {
    isRegenerated: boolean;
    elements: number;
    namespaces: number;
};

const REFERENCE_PATH = ".gtkx/reference";
const SKIPPED: ReferenceResult = { isRegenerated: false, elements: 0, namespaces: 0 };

const writeReference = async (options: WriteReferenceOptions): Promise<ReferenceResult> => {
    const { root, config, girPath, libraries } = options;

    if (!options.isEnabled) {
        removeDocs(join(root, REFERENCE_PATH));

        return SKIPPED;
    }

    if (girPath.length === 0 || libraries.length === 0) {
        return SKIPPED;
    }

    const builtin = await readBuiltinElementsForDocs();

    const { isRegenerated, namespaces } = writeDocs({
        libraries,
        girPath,
        outDir: join(root, REFERENCE_PATH),
        resolveFrom: root,
        declarationDir: options.declarationDir,
        basePath: REFERENCE_PATH,
        linkStyle: "file",
        props: { ...builtin.props, ...resolveElementProps(config.elements) },
        acceptedChildTypes: { ...builtin.acceptedChildTypes, ...resolveAcceptedChildTypes(config.elements) },
        omittedProps: mergeOmittedProps(builtin.omittedProps, resolveOmittedProps(config.elements)),
        lazyElements: [...builtin.lazyElements, ...resolveLazyElements(config.elements)],
        isForced: options.isForced === true,
    });

    return {
        isRegenerated,
        elements: namespaces.reduce((total, namespace) => total + namespace.elements.length, 0),
        namespaces: namespaces.length,
    };
};

export { REFERENCE_PATH, writeReference, type ReferenceResult };
