import { sortStrings } from "@gtkx/utils";
import { join } from "node:path";
import { z } from "zod";
import { type GirNamespace, namespaceDirectory } from "../../gir/namespace.js";
import { readJsonFile } from "../../json.js";

const namespaceIncludesSchema = z.object({ includes: z.record(z.string(), z.array(z.string())) });

/** The namespace directories of a generated `@gtkx/gi` store, each mapped to the directories its GIR includes. */
type NamespaceIncludes = Record<string, string[]>;

const NAMESPACES_FILENAME = "namespaces.json";

const collectNamespaceIncludes = (namespaces: Iterable<GirNamespace>): NamespaceIncludes =>
    Object.fromEntries(
        [...namespaces].map((namespace) => [
            namespaceDirectory(namespace),
            sortStrings(namespace.includes.map((name) => namespaceDirectory({ name }))),
        ]),
    );

const renderNamespaceIncludes = (includes: NamespaceIncludes): string => `${JSON.stringify({ includes }, null, 2)}\n`;

const readNamespaceIncludes = (giStoreDir: string): NamespaceIncludes | null =>
    namespaceIncludesSchema.safeParse(readJsonFile(join(giStoreDir, NAMESPACES_FILENAME))).data?.includes ?? null;

export {
    NAMESPACES_FILENAME,
    collectNamespaceIncludes,
    type NamespaceIncludes,
    readNamespaceIncludes,
    renderNamespaceIncludes,
};
