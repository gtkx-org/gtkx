import type { ModuleContext } from "../../writer/context.js";

type WrapperClassRegistration = {
    className: string;
    gtypeExpr?: string | undefined;
    vfuncs?: string | undefined;
};

type InterfaceRegistration = {
    className: string;
    makerName: string;
    gtypeExpr?: string | undefined;
    layout?: string | undefined;
};

const appendWrapperClassRegistration = (
    context: ModuleContext,
    registration: WrapperClassRegistration,
): void => {
    const { className, gtypeExpr, vfuncs } = registration;

    if (gtypeExpr === undefined) {
        return;
    }

    context.addRuntimeImport("registerWrapperClass");
    const args = vfuncs === undefined ? gtypeExpr : `${gtypeExpr}, ${vfuncs}`;
    context.collectRegistration(`registerWrapperClass(${className}, ${args});`, [className]);
};

const appendInterfaceRegistration = (context: ModuleContext, registration: InterfaceRegistration): void => {
    const { className, makerName, gtypeExpr, layout } = registration;

    if (gtypeExpr === undefined) {
        return;
    }

    context.addRuntimeImport("registerInterface");
    const base = `${className}, ${gtypeExpr}, ${makerName}`;
    const args = layout === undefined ? base : `${base}, ${layout}`;
    context.collectRegistration(`registerInterface(${args});`, [className, makerName]);
};

export { appendWrapperClassRegistration, appendInterfaceRegistration };
