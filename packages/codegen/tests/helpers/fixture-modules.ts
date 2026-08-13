import { dirname } from "node:path";
import type { GirNamespace } from "../../src/gir/namespace.js";
import { Library } from "../../src/gir/library.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";
import { FIXTURE_GIR_DIR, FIXTURE_GIR_PATH } from "./gir-path.js";

const isFixtureNamespace = (namespace: GirNamespace): boolean => dirname(namespace.girFile) === FIXTURE_GIR_DIR;

const fixtureModules = (names: string[]): Map<string, string> => {
    const library = Library.load(names, FIXTURE_GIR_PATH);

    return new Map(
        library.namespaces
            .values()
            .filter((namespace) => isFixtureNamespace(namespace))
            .map((namespace) => [namespace.name, generateNamespaceModule(namespace, library)]),
    );
};

export { fixtureModules };
