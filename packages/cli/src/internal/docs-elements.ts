import { type ElementProps, type OmittedProps, readBuiltinElements, resolveStore } from "@gtkx/codegen";
import { existsSync } from "node:fs";

type DocsElements = {
    props: ElementProps;
    omittedProps: OmittedProps;
};

const resolveDocsElements = async (cwd: string): Promise<DocsElements> => {
    const { gi, reactSubexports } = resolveStore(cwd);

    if (!existsSync(gi.storeDir)) {
        return { props: {}, omittedProps: {} };
    }

    const { props, omittedProps } = await readBuiltinElements(reactSubexports, gi.storeDir);

    return { props, omittedProps };
};

export { resolveDocsElements };
