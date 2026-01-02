import {
    type ExportDeclarationStructure,
    IndentationText,
    NewLineKind,
    Project,
    QuoteKind,
    StructureKind,
} from "ts-morph";

export const generateIndex = async (fileNames: IterableIterator<string>): Promise<string> => {
    const project = new Project({
        useInMemoryFileSystem: true,
        manipulationSettings: {
            indentationText: IndentationText.FourSpaces,
            newLineKind: NewLineKind.LineFeed,
            quoteKind: QuoteKind.Double,
        },
    });

    const sourceFile = project.createSourceFile("index.ts", "");

    const exportStructures: ExportDeclarationStructure[] = Array.from(fileNames)
        .filter((f) => f !== "index.ts")
        .map((f) => ({
            kind: StructureKind.ExportDeclaration as const,
            moduleSpecifier: `./${f.replace(".ts", "")}.js`,
        }));

    sourceFile.addExportDeclarations(exportStructures);

    return sourceFile.getFullText();
};
