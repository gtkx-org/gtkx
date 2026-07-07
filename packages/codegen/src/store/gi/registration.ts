import type { ModuleContext } from "../../writer/context.js";

type WrapperClassRegistration = {
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

type InterfaceRegistration = {
    className: string;
    makerName: string;
    gtypeExpr?: string | undefined;
    vfuncs?: string | undefined;
};

export const appendInterfaceRegistration = (context: ModuleContext, registration: InterfaceRegistration): void => {
    const { className, makerName, gtypeExpr, vfuncs } = registration;
    if (gtypeExpr === undefined) {
        return;
    }
    context.addRuntimeImport("registerInterface");
    const base = `${className}, ${gtypeExpr}, ${makerName}`;
    const args = vfuncs === undefined ? base : `${base}, ${vfuncs}`;
    context.module.appendRegistration(`registerInterface(${args});`);
};
