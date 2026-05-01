import type { GirParameter } from "./parameter.js";
import type { GirType } from "./type.js";

type GirCallableData = {
    name: string;
    cIdentifier: string;
    returnType: GirType;
    parameters: GirParameter[];
    throws: boolean;
    doc?: string;
    returnDoc?: string;
    shadows?: string;
    shadowedBy?: string;
};

/**
 * Shared base for callable GIR entities (methods, constructors, functions).
 *
 * Provides common fields and parameter helpers; subclasses add role-specific
 * data (e.g. `instanceParameter` for methods).
 */
abstract class GirCallable {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: GirType;
    readonly parameters: GirParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;
    readonly shadows?: string;
    readonly shadowedBy?: string;

    protected constructor(data: GirCallableData) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
        this.shadows = data.shadows;
        this.shadowedBy = data.shadowedBy;
    }

    /** Gets required (non-optional, non-nullable) input parameters. */
    getRequiredParameters(): GirParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }

    /** True if this follows the async/finish pattern. */
    isAsync(): boolean {
        return this.name.endsWith("_async") || this.parameters.some((p) => p.scope === "async");
    }
}

/**
 * Method on a class, interface, or record.
 */
export class GirMethod extends GirCallable {
    readonly instanceParameter?: GirParameter;
    readonly finishFunc?: string;

    constructor(
        data: GirCallableData & {
            instanceParameter?: GirParameter;
            finishFunc?: string;
        },
    ) {
        super(data);
        this.instanceParameter = data.instanceParameter;
        this.finishFunc = data.finishFunc;
    }

    /** True if this is a _finish method for an async operation. */
    isAsyncFinish(): boolean {
        return this.name.endsWith("_finish");
    }

    /** Gets the corresponding _finish method name if this is async. */
    getFinishMethodName(): string | null {
        if (this.name.endsWith("_async")) {
            return this.name.replace(/_async$/, "_finish");
        }
        return null;
    }

    /** Gets optional parameters. */
    getOptionalParameters(): GirParameter[] {
        return this.parameters.filter((p) => p.optional || p.nullable);
    }

    /** True if any parameter is an out parameter. */
    hasOutParameters(): boolean {
        return this.parameters.some((p) => p.direction === "out" || p.direction === "inout");
    }

    /** Gets out parameters only. */
    getOutParameters(): GirParameter[] {
        return this.parameters.filter((p) => p.direction === "out" || p.direction === "inout");
    }
}

/**
 * Constructor for a class or record.
 */
export class GirConstructor extends GirCallable {
    constructor(data: GirCallableData) {
        super(data);
    }
}

/**
 * Standalone function or static method.
 */
export class GirFunction extends GirCallable {
    constructor(data: GirCallableData) {
        super(data);
    }
}
