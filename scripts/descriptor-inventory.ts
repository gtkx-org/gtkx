import { t } from "@gtkx/runtime";
import { type Dirent, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import ts from "typescript";

type DescriptorWitness = {
    source: string;
    line: number;
};

type DescriptorInventoryEntry = {
    name: string;
    witnesses: DescriptorWitness[];
};

type DescriptorInventory = {
    descriptors: DescriptorInventoryEntry[];
};

type DescriptorInventoryOptions = {
    root: string;
    giStore: string;
};

type WriteDescriptorInventoryOptions = DescriptorInventoryOptions & {
    output: string;
};

const SOURCE_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const EXCLUDED_HELPERS = new Set(["bind", "field", "fieldAt", "fn"]);
const EXCLUDED_PACKAGES = new Set(["codegen", "runtime"]);

const compareText = (left: string, right: string): number => {
    if (left < right) {
        return -1;
    }

    if (left > right) {
        return 1;
    }

    return 0;
};

const isSourceFile = (path: string): boolean => {
    const name = basename(path);

    return SOURCE_EXTENSIONS.has(extname(path)) &&
        !name.endsWith(".d.ts") &&
        !name.includes(".spec.") &&
        !name.includes(".test.");
};

const entrySourceFiles = (directory: string, entry: Dirent): string[] => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
        return entry.name === "__tests__" ? [] : sourceFiles(path);
    }

    return isSourceFile(path) ? [path] : [];
};

const sourceFiles = (directory: string): string[] => {
    const entries = readdirSync(directory, { withFileTypes: true });

    return entries.flatMap((entry) => entrySourceFiles(directory, entry));
};

const hasRuntimeDescriptorImport = (sourceFile: ts.SourceFile): boolean =>
    sourceFile.statements.some((statement) => {
        if (!ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            statement.moduleSpecifier.text !== "@gtkx/runtime") {
            return false;
        }

        const bindings = statement.importClause?.namedBindings;

        return bindings !== undefined && ts.isNamedImports(bindings) &&
            bindings.elements.some((element) =>
                element.name.text === "t" && (element.propertyName ?? element.name).text === "t",
            );
    });

const descriptorWitnesses = (
    path: string,
    source: string,
    helpers: ReadonlySet<string>,
): Map<string, DescriptorWitness> => {
    const sourceFile = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const witnesses: Map<string, DescriptorWitness> = new Map();

    if (!hasRuntimeDescriptorImport(sourceFile)) {
        return witnesses;
    }

    const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "t" &&
            helpers.has(node.name.text) &&
            !witnesses.has(node.name.text)) {
            witnesses.set(node.name.text, {
                source,
                line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            });
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return witnesses;
};

const packageSourceFiles = (root: string): string[] => {
    const packages = join(root, "packages");

    return readdirSync(packages, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !EXCLUDED_PACKAGES.has(entry.name))
        .flatMap((entry) => {
            const source = join(packages, entry.name, "src");

            return existsSync(source) ? sourceFiles(source) : [];
        });
};

const generateDescriptorInventory = (options: DescriptorInventoryOptions): DescriptorInventory => {
    const helpers = new Set(Object.keys(t).filter((name) => !EXCLUDED_HELPERS.has(name)));
    const sources = [
        ...sourceFiles(options.giStore).map((path) => ({ path, source: `gi/${relative(options.giStore, path)}` })),
        ...packageSourceFiles(options.root).map((path) => ({ path, source: relative(options.root, path) })),
    ].toSorted((left, right) => compareText(left.source, right.source));
    const witnesses: Map<string, DescriptorWitness[]> = new Map();

    for (const source of sources) {
        for (const [name, witness] of descriptorWitnesses(source.path, source.source, helpers)) {
            const entries = witnesses.get(name) ?? [];

            entries.push(witness);
            witnesses.set(name, entries);
        }
    }

    return {
        descriptors: [...witnesses]
            .toSorted(([left], [right]) => compareText(left, right))
            .map(([name, entries]) => ({ name, witnesses: entries })),
    };
};

const writeDescriptorInventory = (options: WriteDescriptorInventoryOptions): DescriptorInventory => {
    const inventory = generateDescriptorInventory(options);

    writeFileSync(options.output, `${JSON.stringify(inventory, null, 2)}\n`);

    return inventory;
};

export {
    writeDescriptorInventory,
};
