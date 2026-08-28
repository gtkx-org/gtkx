import type { Config } from "@gtkx/config";
import { mergeOmittedProps } from "@gtkx/codegen";
import { writeDocs } from "@gtkx/codegen/internal";
import { isAgentReferenceEnabled, resolveOmittedProps } from "@gtkx/config/internal";
import { join } from "node:path";
import { resolveDocsElements } from "../internal/docs-elements.js";

type WriteReferenceOptions = {
    root: string;
    config: Config;
    girPath: string[];
    libraries: string[];
    isForced?: boolean;
};

type ReferenceResult = {
    isRegenerated: boolean;
    elements: number;
    namespaces: number;
};

const REFERENCE_PATH = ".gtkx/reference";
const SKIPPED: ReferenceResult = { isRegenerated: false, elements: 0, namespaces: 0 };

const resolveReferenceDir = (root: string): string => join(root, ".gtkx", "reference");

const writeReference = async (options: WriteReferenceOptions): Promise<ReferenceResult> => {
    const { root, config, girPath, libraries } = options;

    if (!isAgentReferenceEnabled(config) || girPath.length === 0 || libraries.length === 0) {
        return SKIPPED;
    }

    const builtin = await resolveDocsElements(root);

    const { isRegenerated, namespaces } = writeDocs({
        libraries,
        girPath,
        outDir: resolveReferenceDir(root),
        basePath: REFERENCE_PATH,
        linkStyle: "file",
        props: builtin.props,
        omittedProps: mergeOmittedProps(builtin.omittedProps, resolveOmittedProps(config.elements)),
        isForced: options.isForced === true,
        isByteArrayTyped: config.future?.v2ByteArrays === true,
        isValueUnwrapped: config.future?.v2ValueReturns === true,
        isFinishTrimmed: config.future?.v2FinishResults === true,
        isInoutInPlace: config.future?.v2InoutReturns === true,
        isTreeShaken: config.future?.v2TreeShaking === true,
    });

    return {
        isRegenerated,
        elements: namespaces.reduce((total, namespace) => total + namespace.elements.length, 0),
        namespaces: namespaces.length,
    };
};

export { REFERENCE_PATH, writeReference, type ReferenceResult };
