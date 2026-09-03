import {
    type ElementProps,
    type OmittedProps,
    resolveStore,
} from "@gtkx/codegen";
import { readBuiltinElementsForDocs } from "@gtkx/codegen/internal";
import { existsSync } from "node:fs";

type DocsElements = {
    props: ElementProps;
    omittedProps: OmittedProps;
    acceptedChildTypes: Record<string, string[]>;
};

const resolveDocsElements = async (cwd: string): Promise<DocsElements> => {
    const { gi } = resolveStore(cwd);

    if (!existsSync(gi.storeDir)) {
        return { props: {}, omittedProps: {}, acceptedChildTypes: {} };
    }

    const { props, omittedProps, acceptedChildTypes } = await readBuiltinElementsForDocs();

    return { props, omittedProps, acceptedChildTypes };
};

export { resolveDocsElements };
