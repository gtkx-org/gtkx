import type { ExternalObject, Handle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

type ClassInitializer = (handle: ExternalObject<Handle>) => void;
type ClassOptionHandler = (klass: AnyClass, value: unknown) => ClassInitializer;

const classOptionHandlers: Map<string, ClassOptionHandler> = new Map();

/** Registers generated binding support for an option applied during native class initialization. */
function registerClassOption(name: string, handler: ClassOptionHandler): void {
    classOptionHandlers.set(name, handler);
}

function prepareClassOptions(klass: AnyClass, options: Record<string, unknown>): ClassInitializer {
    const initializers: ClassInitializer[] = [];

    for (const [name, value] of Object.entries(options)) {
        if (value === undefined) {
            continue;
        }

        const handler = classOptionHandlers.get(name);

        if (handler === undefined) {
            throw new TypeError(`No generated binding handles the class option '${name}'`);
        }

        initializers.push(handler(klass, value));
    }

    return (handle) => {
        for (const initialize of initializers) {
            initialize(handle);
        }
    };
}

export { prepareClassOptions, registerClassOption };
