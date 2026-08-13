import { ModuleContext } from "./context.js";

const COMPARISON_CONTEXTS: WeakMap<ModuleContext, ModuleContext> = new WeakMap();

const comparisonContextFor = (context: ModuleContext): ModuleContext => {
    const existing = COMPARISON_CONTEXTS.get(context);

    if (existing !== undefined) {
        return existing;
    }

    const created = new ModuleContext(context.namespace, context.library);
    COMPARISON_CONTEXTS.set(context, created);

    return created;
};

export { comparisonContextFor };
