class ScaffoldAbortedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ScaffoldAbortedError";
    }
}

class OperationCanceledError extends Error {
    constructor() {
        super("Operation canceled");
        this.name = "OperationCanceledError";
    }
}

export { OperationCanceledError, ScaffoldAbortedError };
