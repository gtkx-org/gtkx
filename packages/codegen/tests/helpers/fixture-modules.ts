import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Library } from "../../src/gir/library.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";

const FIXTURE_GIR_PATH = [join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "gir")];

const fixtureModules = (names: string[]): Map<string, string> => {
    const library = Library.load(names, FIXTURE_GIR_PATH);

    return new Map(
        library.namespaces.values().map((namespace) => [namespace.name, generateNamespaceModule(namespace, library)]),
    );
};

export { fixtureModules };
