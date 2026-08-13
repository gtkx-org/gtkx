import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceModule } from "../../src/compile.js";
import { resolveGirPath } from "../../src/gir/gir-path.js";
import { Library } from "../../src/gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../../src/gir/namespace.js";
import { collectStoreSources } from "../../src/store/gi-store.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";

const FIXTURE_GIR_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "gir");

const loadFixtures = (names: string[]): Library => Library.load(names, resolveGirPath([FIXTURE_GIR_DIR]));
const isFixtureNamespace = (namespace: GirNamespace): boolean => dirname(namespace.girFile) === FIXTURE_GIR_DIR;

const fixtureModules = (names: string[]): Map<string, string> => {
    const library = loadFixtures(names);

    return new Map(
        library.namespaces
            .values()
            .filter((namespace) => isFixtureNamespace(namespace))
            .map((namespace) => [namespace.name, generateNamespaceModule(namespace, library)]),
    );
};

const fixtureStoreModules = (names: string[]): SourceModule[] => {
    const library = loadFixtures(names);

    const namespaces = library.namespaces
        .values()
        .map((namespace) => ({
            directory: namespaceDirectory(namespace),
            rawSource: generateNamespaceModule(namespace, library),
            girFile: namespace.girFile,
        }))
        .toArray();

    return collectStoreSources(namespaces).collected;
};

export { fixtureModules, fixtureStoreModules };
