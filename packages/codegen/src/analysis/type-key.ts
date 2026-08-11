import type { Library } from "../gir/library.js";
import type { TypeId } from "../gir/type-id.js";

const typeKey = (library: Library, ref: TypeId | undefined): string => {
    if (ref === undefined) {
        return "void";
    }

    const type = library.typeFor(ref);

    return type?.kind === "primitive" && type.category === "void" ? "void" : `${String(ref.nsId)}.${String(ref.id)}`;
};

export { typeKey };
