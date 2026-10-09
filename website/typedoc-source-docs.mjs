import { existsSync, readFileSync } from "node:fs";
import { SourceMap } from "node:module";
import { relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Converter, ReflectionKind } from "typedoc";

const root = fileURLToPath(new URL("..", import.meta.url));

const removeInvalidDefault = (context, reflection) => {
    if (!reflection.kindOf(ReflectionKind.Property) || reflection.defaultValue === undefined) {
        return;
    }

    const symbol = context.getSymbolFromReflection(reflection);
    const initializer = symbol?.getDeclarations()?.[0]?.initializer;

    if (!symbol || !initializer) {
        return;
    }

    const initializerType = context.checker.getTypeAtLocation(initializer);
    const propertyType = context.checker.getTypeOfSymbol(symbol);

    if (!context.checker.isTypeAssignableTo(initializerType, propertyType)) {
        delete reflection.defaultValue;
    }
};

const resolveDeclarationSource = (source) => {
    if (!/\.d\.[cm]?ts$/.test(source.fullFileName)) {
        return;
    }

    try {
        const mapUrl = pathToFileURL(`${source.fullFileName}.map`);
        const payload = JSON.parse(readFileSync(mapUrl, "utf8"));
        const origin = new SourceMap(payload).findOrigin(source.line, source.character + 1);

        if (
            typeof origin.fileName !== "string" ||
            !Number.isSafeInteger(origin.lineNumber) ||
            origin.lineNumber < 1 ||
            !Number.isSafeInteger(origin.columnNumber) ||
            origin.columnNumber < 1
        ) {
            return;
        }

        const sourceRoot = payload.sourceRoot ? new URL(payload.sourceRoot.replace(/\/?$/, "/"), mapUrl) : mapUrl;
        const fileName = fileURLToPath(new URL(origin.fileName, sourceRoot));

        if (existsSync(fileName)) {
            source.fullFileName = fileName;
            source.line = origin.lineNumber;
            source.character = origin.columnNumber - 1;
        }
    } catch {
        return;
    }
};

const formatSource = (source, app) => {
    resolveDeclarationSource(source);
    source.fileName = relative(root, source.fullFileName).split(sep).join("/");
    source.url = app.repositories?.getURL(source.fullFileName, source.line);

    return source;
};

const load = (app) => {
    app.converter.on(Converter.EVENT_CREATE_DECLARATION, removeInvalidDefault);
    app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
        for (const reflection of Object.values(context.project.reflections)) {
            const sources = reflection.sources?.filter(
                (source) => !source.fullFileName.split(/[\\/]/).includes("node_modules"),
            );

            if (sources?.length) {
                reflection.sources = sources.map((source) => formatSource(source, app));
            } else {
                delete reflection.sources;
            }
        }
    });
};

export { load };
