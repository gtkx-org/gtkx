import type { ModuleContext } from "../dsl/context.js";

export type WrapperClassRegistration = {
    className: string;
    gtypeExpr?: string | undefined;
    vfuncs?: string | undefined;
};

export const appendWrapperClassRegistration = (
    context: ModuleContext,
    registration: WrapperClassRegistration,
): void => {
    const { className, gtypeExpr, vfuncs } = registration;
    if (gtypeExpr === undefined) {
        return;
    }
    context.addRuntimeImport("registerWrapperClass");
    const args = vfuncs === undefined ? gtypeExpr : `${gtypeExpr}, ${vfuncs}`;
    context.module.appendRegistration(`registerWrapperClass(${className}, ${args});`);
};
