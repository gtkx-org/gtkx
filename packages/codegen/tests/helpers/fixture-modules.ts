import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Library } from "../../src/gir/library.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";

const SYSTEM_GIR_PATH = "/usr/share/gir-1.0";
const FIXTURE_GIR_PATH = [join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "gir"), SYSTEM_GIR_PATH];

const namespaceNames = (names: string[]): Set<string> =>
    new Set(names.map((name) => name.slice(0, name.lastIndexOf("-"))));

const fixtureModules = (names: string[]): Map<string, string> => {
    const library = Library.load(names, FIXTURE_GIR_PATH);
    const requested = namespaceNames(names);

    return new Map(
        library.namespaces
            .values()
            .filter((namespace) => requested.has(namespace.name))
            .map((namespace) => [namespace.name, generateNamespaceModule(namespace, library)]),
    );
};

export { fixtureModules };
