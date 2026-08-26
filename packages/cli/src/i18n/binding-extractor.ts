import { types as babel, type NodePath as BabelNodePath, parseAsync, traverse } from "@babel/core";
import { extname } from "node:path";

type ApiName =
    | "IcuTrans" |
    "IcuTransWithoutContext" |
    "Trans" |
    "TransWithoutContext" |
    "Translation" |
    "getFixedT" |
    "getI18n" |
    "init" |
    "t" |
    "useTranslation" |
    "withTranslation";

type ScopeInfo = {
    defaultNs?: string;
    keyPrefix?: string;
    namespaces?: string[];
};

type TSemantic = {
    fixed: boolean;
    info: ScopeInfo;
    kind: "t";
};

type Semantic =
    | TSemantic |
    { api: ApiName; kind: "api" } |
    { info: ScopeInfo; kind: "enhancer" } |
    { kind: "initPromise" } |
    { kind: "namespace"; module: string } |
    { kind: "translationContext" } |
    { instance: boolean; kind: "translationObject"; t: TSemantic };

type ExtractedCall = {
    info: ScopeInfo;
    key: string;
};

type ExtractedMessage = {
    defaultValue: string;
    explicitDefault: boolean;
    key: string;
    location: {
        column?: number;
        file: string;
        line?: number;
    };
    ns?: string;
};

type BindingExtraction = {
    blockedGetFixedT: Set<string>;
    calls: Map<string, ExtractedCall>;
    errors: string[];
    messages: ExtractedMessage[];
    trans: Map<string, ScopeInfo | null>;
};

type NodePath<T extends babel.Node = babel.Node> = BabelNodePath<T>;
type Binding = NonNullable<ReturnType<NodePath["scope"]["getBinding"]>>;
type ParserPlugin = "decorators-legacy" | "jsx" | "typescript";

type ScopeCallInput = {
    file: string;
    namespaceIndex: number;
    optionsIndex?: number;
    path: NodePath;
    prefixIndex?: number;
};

type ComponentInput = {
    contextPath?: NodePath | undefined;
    countPath?: NodePath | undefined;
    defaultPath?: NodePath | undefined;
    isIcu: boolean;
    keyPath?: NodePath | undefined;
    namespacePath?: NodePath | undefined;
    optionsPath?: NodePath | undefined;
    path: NodePath;
    tPath?: NodePath | undefined;
    valuesPath?: NodePath | undefined;
};

type ComponentKeys = {
    fallback?: string | undefined;
    rawKeys: string[];
};

type ComponentScope = {
    keys: string[];
    ns?: string | undefined;
};

type Resolution<T> = {
    isValid: boolean;
    value?: T | undefined;
};

type MessageInput = {
    defaultValue: string;
    hasExplicitDefault: boolean;
    key: string;
    ns?: string | undefined;
    path: NodePath;
};

type PluralPairInput = {
    key: string;
    ns?: string | undefined;
    path: NodePath;
    plural: string;
    singular: string;
};

const API_NAMES: readonly ApiName[] = [
    "IcuTrans",
    "IcuTransWithoutContext",
    "Trans",
    "TransWithoutContext",
    "Translation",
    "getFixedT",
    "getI18n",
    "init",
    "t",
    "useTranslation",
    "withTranslation",
];

const API_NAME_SET: Set<string> = new Set(API_NAMES);
const GTKX_MODULE = "@gtkx/i18n";
const I18NEXT_MODULE = "i18next";
const REACT_I18NEXT_MODULE = "react-i18next";
const SUPPORTED_MODULES = new Set([GTKX_MODULE, I18NEXT_MODULE, REACT_I18NEXT_MODULE]);
const I18NEXT_APIS: Set<ApiName> = new Set(["getFixedT", "init", "t"]);
const CONTEXT_SEPARATOR = "\u{4}";
const EMPTY_INFO: ScopeInfo = {};
const GLOBAL_T: TSemantic = { fixed: false, info: EMPTY_INFO, kind: "t" };

const oneChild = (path: NodePath, key: string): NodePath | undefined => {
    const value = path.get(key);

    return Array.isArray(value) || value.node === null ? undefined : value;
};

const childPaths = (path: NodePath, key: string): NodePath[] => {
    const value = path.get(key);

    return Array.isArray(value)
        ? value.filter((candidate) => candidate.node !== null)
        : [];
};

const isTransparentExpression = (path: NodePath): boolean => [
    path.isParenthesizedExpression(),
    path.isTSAsExpression(),
    path.isTSInstantiationExpression(),
    path.isTSNonNullExpression(),
    path.isTSSatisfiesExpression(),
    path.isTSTypeAssertion(),
].includes(true);

const unwrapPath = (path: NodePath): NodePath => {
    let current = path;

    while (isTransparentExpression(current)) {
        const expression = oneChild(current, "expression");

        if (expression === undefined) {
            return current;
        }

        current = expression;
    }

    return current;
};

const staticPropertyName = (path: NodePath): string | undefined => {
    if (path.isIdentifier()) {
        return path.node.name;
    }

    if (path.isStringLiteral()) {
        return path.node.value;
    }

    return path.isNumericLiteral() ? String(path.node.value) : undefined;
};

const memberProperty = (path: NodePath): string | undefined => {
    const member = unwrapPath(path);

    if (!member.isMemberExpression() && !member.isOptionalMemberExpression()) {
        return;
    }

    const property = oneChild(member, "property");

    if (property === undefined) {
        return;
    }

    return !member.node.computed && property.isIdentifier()
        ? property.node.name
        : staticPropertyName(property);
};

const constantDeclaratorBinding = (
    path: NodePath,
    resolving: Set<Binding>,
): Binding | undefined => {
    if (!path.isIdentifier()) {
        return;
    }

    const binding = path.scope.getBinding(path.node.name);

    if (!binding?.constant) {
        return;
    }

    return resolving.has(binding) || !binding.path.isVariableDeclarator()
        ? undefined
        : binding;
};

const literalIdentifierString = (
    path: NodePath,
    resolving: Set<Binding>,
): string | undefined => {
    const binding = constantDeclaratorBinding(path, resolving);

    if (binding === undefined) {
        return;
    }

    const init = oneChild(binding.path, "init");

    if (init === undefined) {
        return;
    }

    resolving.add(binding);
    const resolved = literalString(init, resolving);
    resolving.delete(binding);

    return resolved;
};

const literalMemberString = (
    path: NodePath,
    resolving: Set<Binding>,
): string | undefined => {
    const object = oneChild(path, "object");
    const property = memberProperty(path);

    if (property === undefined || object?.isIdentifier() !== true) {
        return;
    }

    const binding = constantDeclaratorBinding(object, resolving);

    if (binding === undefined) {
        return;
    }

    const member = objectProperty(oneChild(binding.path, "init"), property);

    if (member === undefined) {
        return;
    }

    resolving.add(binding);
    const resolved = literalString(member, resolving);
    resolving.delete(binding);

    return resolved;
};

const directLiteralString = (value: NodePath): string | undefined => {
    if (value.isStringLiteral()) {
        return value.node.value;
    }

    if (!value.isTemplateLiteral() || value.node.expressions.length > 0) {
        return;
    }

    const quasi = value.node.quasis[0];

    return quasi?.value.cooked ?? quasi?.value.raw;
};

const literalString = (
    path: NodePath | undefined,
    resolving: Set<Binding> = new Set(),
): string | undefined => {
    if (path === undefined) {
        return;
    }

    const value = unwrapPath(path);
    const direct = directLiteralString(value);

    if (direct !== undefined) {
        return direct;
    }

    return value.isIdentifier()
        ? literalIdentifierString(value, resolving)
        : literalMemberString(value, resolving);
};

const isStaticObjectProperty = (path: NodePath, resolving: Set<Binding>): boolean => {
    if (!path.isSpreadElement()) {
        return true;
    }

    return isStaticObject(oneChild(path, "argument"), resolving);
};

const isStaticObject = (
    path: NodePath | undefined,
    resolving: Set<Binding> = new Set(),
): boolean => {
    if (path === undefined) {
        return false;
    }

    const value = unwrapPath(path);
    const binding = constantDeclaratorBinding(value, resolving);

    if (binding !== undefined) {
        resolving.add(binding);
        const isResult = isStaticObject(oneChild(binding.path, "init"), resolving);
        resolving.delete(binding);

        return isResult;
    }

    return value.isObjectExpression() &&
        childPaths(value, "properties").every((property) => isStaticObjectProperty(property, resolving));
};

const propertyKeyName = (
    property: NodePath<babel.ObjectMethod | babel.ObjectProperty>,
): string | undefined => {
    const key = oneChild(property, "key");

    if (key === undefined) {
        return;
    }

    const propertyName = property.node.computed
        ? literalString(key)
        : staticPropertyName(key);

    if (propertyName === undefined && property.node.computed) {
        throw new Error("Translation options cannot contain dynamic computed properties");
    }

    return propertyName;
};

const spreadPropertyValue = (
    property: NodePath,
    name: string,
    resolving: Set<Binding>,
): NodePath | undefined => {
    const argument = oneChild(property, "argument");
    const spread = objectProperty(argument, name, resolving);

    if (spread !== undefined) {
        return spread;
    }

    if (!isStaticObject(argument)) {
        throw new Error("Translation options cannot contain dynamic object spreads");
    }

    return undefined;
};

const directPropertyValue = (property: NodePath, name: string): NodePath | undefined => {
    if (!property.isObjectMethod() && !property.isObjectProperty()) {
        return;
    }

    if (propertyKeyName(property) !== name) {
        return;
    }

    if (property.isObjectMethod()) {
        return property;
    }

    const key = oneChild(property, "key");

    return property.node.shorthand ? key : oneChild(property, "value");
};

const objectPropertyEntry = (
    property: NodePath,
    name: string,
    resolving: Set<Binding>,
): NodePath | undefined => property.isSpreadElement()
    ? spreadPropertyValue(property, name, resolving)
    : directPropertyValue(property, name);

const objectExpressionProperty = (
    value: NodePath,
    name: string,
    resolving: Set<Binding>,
): NodePath | undefined => {
    for (const property of childPaths(value, "properties").toReversed()) {
        const result = objectPropertyEntry(property, name, resolving);

        if (result !== undefined) {
            return result;
        }
    }

    return undefined;
};

const objectProperty = (
    path: NodePath | undefined,
    name: string,
    resolving: Set<Binding> = new Set(),
): NodePath | undefined => {
    if (path === undefined) {
        return;
    }

    const value = unwrapPath(path);
    const binding = constantDeclaratorBinding(value, resolving);

    if (binding !== undefined) {
        resolving.add(binding);
        const resolved = objectProperty(oneChild(binding.path, "init"), name, resolving);
        resolving.delete(binding);

        return resolved;
    }

    if (!value.isObjectExpression()) {
        return;
    }

    return objectExpressionProperty(value, name, resolving);
};

const resolvedNamespaceIdentifier = (
    value: NodePath,
    resolving: Set<Binding>,
): string[] | undefined => {
    const binding = constantDeclaratorBinding(value, resolving);

    if (binding === undefined) {
        return;
    }

    resolving.add(binding);
    const resolved = namespaceValues(oneChild(binding.path, "init"), resolving);
    resolving.delete(binding);

    return resolved;
};

const namespaceValues = (
    path: NodePath | undefined,
    resolving: Set<Binding> = new Set(),
): string[] => {
    const direct = literalString(path);

    if (direct !== undefined) {
        return [direct];
    }

    if (path === undefined) {
        return [];
    }

    const value = unwrapPath(path);
    const resolved = resolvedNamespaceIdentifier(value, resolving);

    if (resolved !== undefined) {
        return resolved;
    }

    if (!value.isArrayExpression()) {
        return [];
    }

    const values = childPaths(value, "elements").map((element) => literalString(element, resolving));

    return values.every((candidate): candidate is string => candidate !== undefined) ? values : [];
};

const normalizedInfo = (namespaces: string[], keyPrefix: string | undefined): ScopeInfo => {
    const info: ScopeInfo = {};
    const defaultNs = namespaces[0];

    if (defaultNs !== undefined) {
        info.defaultNs = defaultNs;

        if (namespaces.length > 1) {
            info.namespaces = namespaces;
        }
    }

    if (keyPrefix !== undefined && keyPrefix.length > 0) {
        info.keyPrefix = keyPrefix;
    }

    return info;
};

const isAbsentArgument = (path: NodePath): boolean => {
    if (path.isNullLiteral()) {
        return true;
    }

    return path.isIdentifier() &&
        path.node.name === "undefined" &&
        path.scope.getBinding("undefined") === undefined;
};

const staticNamespaces = (path: NodePath | undefined, file: string): string[] => {
    if (path === undefined || isAbsentArgument(path)) {
        return [];
    }

    const namespaces = namespaceValues(path);

    if (namespaces.length === 0) {
        throw new Error(`Translation namespaces must be static strings in ${file}`);
    }

    return namespaces;
};

const staticKeyPrefix = (path: NodePath | undefined, file: string): string | undefined => {
    if (path === undefined || isAbsentArgument(path)) {
        return;
    }

    const keyPrefix = literalString(path);

    if (keyPrefix === undefined) {
        throw new Error(`Translation key prefixes must be static strings in ${file}`);
    }

    return keyPrefix;
};

const callArguments = (path: NodePath): NodePath[] => childPaths(path, "arguments");

const scopeFromCall = (input: ScopeCallInput): ScopeInfo => {
    const args = callArguments(input.path);
    const options = input.optionsIndex === undefined ? undefined : args[input.optionsIndex];
    const optionPrefix = staticKeyPrefix(objectProperty(options, "keyPrefix"), input.file);
    const positional = input.prefixIndex === undefined ? undefined : args[input.prefixIndex];
    const positionalPrefix = staticKeyPrefix(positional, input.file);

    return normalizedInfo(
        staticNamespaces(args[input.namespaceIndex], input.file),
        optionPrefix ?? positionalPrefix,
    );
};

const isApiName = (name: string): name is ApiName => API_NAME_SET.has(name);

const isApiAvailable = (moduleName: string, api: ApiName): boolean => {
    if (moduleName === GTKX_MODULE) {
        return true;
    }

    if (moduleName === I18NEXT_MODULE) {
        return I18NEXT_APIS.has(api);
    }

    return moduleName === REACT_I18NEXT_MODULE && !I18NEXT_APIS.has(api);
};

const apiSemantic = (api: ApiName): Semantic =>
    api === "t" ? GLOBAL_T : { api, kind: "api" };

const spanKey = (node: { end?: number | null; start?: number | null }): string | undefined =>
    typeof node.start === "number" && typeof node.end === "number"
        ? `${String(node.start)}:${String(node.end)}`
        : undefined;

const pathLocation = (path: NodePath, file: string): ExtractedMessage["location"] => {
    const start = path.node.loc?.start;

    return start === undefined
        ? { file }
        : { column: start.column, file, line: start.line };
};

const patternLocalName = (path: NodePath): string | undefined => {
    const value = unwrapPath(path);

    if (value.isIdentifier()) {
        return value.node.name;
    }

    const left = value.isAssignmentPattern() ? oneChild(value, "left") : undefined;

    return left?.isIdentifier() === true ? left.node.name : undefined;
};

const scopeWithPrefix = (info: ScopeInfo, keyPrefix: string): ScopeInfo => {
    const scoped = { ...info };

    if (keyPrefix.length === 0) {
        delete scoped.keyPrefix;
    } else {
        scoped.keyPrefix = keyPrefix;
    }

    return scoped;
};

const isClassPath = (path: NodePath): boolean => path.isClass();

const isCallPath = (path: NodePath): boolean =>
    path.isCallExpression() || path.isOptionalCallExpression();

const isMemberPath = (path: NodePath): boolean =>
    path.isMemberExpression() || path.isOptionalMemberExpression();

const isStaticStringArray = (path: NodePath | undefined): boolean =>
    path !== undefined && literalString(path) === undefined && namespaceValues(path).length > 0;

const analyzeProgram = (program: NodePath, file: string): BindingExtraction =>
    new BindingAnalyzer(file).analyze(program);

const parserPlugins = (path: string): ParserPlugin[] => {
    const extension = extname(path).toLowerCase();
    const plugins: ParserPlugin[] = ["decorators-legacy"];

    if ([".cts", ".mts", ".ts", ".tsx"].includes(extension)) {
        plugins.push("typescript");
    }

    if ([".cjs", ".js", ".jsx", ".mjs", ".tsx"].includes(extension)) {
        plugins.push("jsx");
    }

    return plugins;
};

const extractBindings = async (code: string, path: string): Promise<BindingExtraction> => {
    const ast = await parseAsync(code, {
        babelrc: false,
        configFile: false,
        filename: path,
        parserOpts: {
            plugins: parserPlugins(path),
            sourceType: "unambiguous",
        },
    });

    if (ast === null) {
        throw new Error(`Unable to parse ${path}`);
    }

    let extraction: BindingExtraction | undefined;

    traverse(ast, {
        Program(programPath) {
            extraction = analyzeProgram(programPath, path);
            programPath.stop();
        },
    });

    if (extraction === undefined) {
        throw new Error(`Unable to analyze ${path}`);
    }

    return extraction;
};

class BindingAnalyzer {
    private readonly bindingCache: Map<Binding, Semantic | null> = new Map();
    private readonly blockedGetFixedT: Set<string> = new Set();
    private readonly calls: Map<string, ExtractedCall> = new Map();
    private readonly errors: Set<string> = new Set();
    private readonly file: string;
    private readonly hocClasses: Map<babel.Node, TSemantic> = new Map();
    private readonly messages: ExtractedMessage[] = [];
    private readonly resolving: Set<Binding> = new Set();
    private readonly specialBindings: Map<Binding, Semantic> = new Map();
    private readonly trans: Map<string, ScopeInfo | null> = new Map();

    constructor(file: string) {
        this.file = file;
    }

    private runSemanticPass(program: NodePath): void {
        program.traverse({
            CallExpression: this.registerCallSemantics.bind(this),
            JSXElement: this.registerJsxElement.bind(this),
            OptionalCallExpression: this.registerCallSemantics.bind(this),
            VariableDeclarator: this.registerBlockedGetFixedT.bind(this),
        });
    }

    private runTranslationPass(program: NodePath): void {
        program.traverse({
            CallExpression: this.registerTranslationCall.bind(this),
            OptionalCallExpression: this.registerTranslationCall.bind(this),
            TaggedTemplateExpression: this.registerTaggedTranslation.bind(this),
        });
    }

    private importSemantic(binding: Binding): Semantic | undefined {
        const path = binding.path;
        const declaration = path.parentPath;

        if (!declaration.isImportDeclaration()) {
            return;
        }

        if (this.isTypeImport(path, declaration)) {
            return;
        }

        const moduleName = declaration.node.source.value;

        if (path.isImportNamespaceSpecifier()) {
            return SUPPORTED_MODULES.has(moduleName) ? { kind: "namespace", module: moduleName } : undefined;
        }

        return this.importSpecifierSemantic(path, moduleName);
    }

    private isTypeImport(path: NodePath, declaration: NodePath<babel.ImportDeclaration>): boolean {
        return declaration.node.importKind === "type" ||
            (path.isImportSpecifier() && path.node.importKind === "type");
    }

    private importSpecifierSemantic(path: NodePath, moduleName: string): Semantic | undefined {
        if (path.isImportDefaultSpecifier()) {
            return moduleName === I18NEXT_MODULE
                ? { kind: "namespace", module: moduleName }
                : undefined;
        }

        return path.isImportSpecifier()
            ? this.namedImportSemantic(path, moduleName)
            : undefined;
    }

    private namedImportSemantic(path: NodePath<babel.ImportSpecifier>, moduleName: string): Semantic | undefined {
        const imported = path.node.imported;
        const name = babel.isIdentifier(imported) ? imported.name : imported.value;

        return isApiName(name) && isApiAvailable(moduleName, name)
            ? apiSemantic(name)
            : undefined;
    }

    private semanticMember(object: Semantic, property: string): Semantic | undefined {
        if (object.kind === "namespace") {
            return this.namespaceMember(object.module, property);
        }

        return this.localSemanticMember(object, property);
    }

    private namespaceMember(moduleName: string, property: string): Semantic | undefined {
        return isApiName(property) && isApiAvailable(moduleName, property)
            ? apiSemantic(property)
            : undefined;
    }

    private localSemanticMember(object: Semantic, property: string): Semantic | undefined {
        if (object.kind === "translationContext") {
            return property === "i18n"
                ? { instance: true, kind: "translationObject", t: GLOBAL_T }
                : undefined;
        }

        return object.kind === "translationObject"
            ? this.translationObjectMember(object, property)
            : undefined;
    }

    private translationObjectMember(
        object: Extract<Semantic, { kind: "translationObject" }>,
        property: string,
    ): Semantic | undefined {
        if (["0", "t"].includes(property)) {
            return object.t;
        }

        if (!object.instance && ["1", "i18n"].includes(property)) {
            return { instance: true, kind: "translationObject", t: GLOBAL_T };
        }

        return object.instance && ["getFixedT", "init"].includes(property)
            ? { api: property as "getFixedT" | "init", kind: "api" }
            : undefined;
    }

    private resolvePath(input: NodePath): Semantic | undefined {
        const path = unwrapPath(input);

        if (path.isIdentifier()) {
            return this.resolveIdentifierPath(path);
        }

        if (isMemberPath(path)) {
            return this.resolveMemberPath(path);
        }

        if (isCallPath(path)) {
            return this.resolveCallPath(path);
        }

        return path.isAwaitExpression()
            ? this.resolveAwaitPath(path)
            : undefined;
    }

    private resolveIdentifierPath(path: NodePath<babel.Identifier>): Semantic | undefined {
        const binding = path.scope.getBinding(path.node.name);

        return binding === undefined ? undefined : this.resolveBinding(binding);
    }

    private resolveMemberPath(path: NodePath): Semantic | undefined {
        const objectPath = oneChild(path, "object");
        const property = memberProperty(path);

        if (objectPath === undefined || property === undefined) {
            return;
        }

        const object = this.resolvePath(objectPath);

        return object === undefined ? undefined : this.semanticMember(object, property);
    }

    private resolveCallPath(path: NodePath): Semantic | undefined {
        const callee = oneChild(path, "callee");

        if (callee === undefined) {
            return;
        }

        const required = this.requireSemantic(path, callee);

        if (required !== undefined) {
            return required;
        }

        const called = this.resolvePath(callee);

        return called?.kind === "api" ? this.apiCallSemantic(called.api, path) : undefined;
    }

    private requireSemantic(path: NodePath, callee: NodePath): Semantic | undefined {
        if (!callee.isIdentifier() || callee.node.name !== "require") {
            return;
        }

        if (callee.scope.getBinding(callee.node.name) !== undefined) {
            return;
        }

        const moduleName = literalString(callArguments(path)[0]);

        return moduleName !== undefined && SUPPORTED_MODULES.has(moduleName)
            ? { kind: "namespace", module: moduleName }
            : undefined;
    }

    private apiCallSemantic(api: ApiName, path: NodePath): Semantic | undefined {
        switch (api) {
            case "useTranslation": {
                return this.useTranslationSemantic(path);
            }
            case "getI18n": {
                return { instance: true, kind: "translationObject", t: GLOBAL_T };
            }
            case "getFixedT": {
                return this.fixedTranslationSemantic(path);
            }
            case "withTranslation": {
                return this.translationEnhancerSemantic(path);
            }
            case "init": {
                return { kind: "initPromise" };
            }
            case "IcuTrans":
            case "IcuTransWithoutContext":
            case "Trans":
            case "TransWithoutContext":
            case "Translation":
            case "t": {
                return;
            }
        }
    }

    private useTranslationSemantic(path: NodePath): Semantic {
        const info = scopeFromCall({ file: this.file, namespaceIndex: 0, optionsIndex: 1, path });

        return {
            instance: false,
            kind: "translationObject",
            t: { fixed: true, info, kind: "t" },
        };
    }

    private fixedTranslationSemantic(path: NodePath): TSemantic {
        const info = scopeFromCall({
            file: this.file,
            namespaceIndex: 1,
            path,
            prefixIndex: 2,
        });

        return { fixed: true, info, kind: "t" };
    }

    private translationEnhancerSemantic(path: NodePath): Semantic {
        const info = scopeFromCall({ file: this.file, namespaceIndex: 0, optionsIndex: 1, path });

        return { info, kind: "enhancer" };
    }

    private resolveAwaitPath(path: NodePath): Semantic | undefined {
        const argument = oneChild(path, "argument");
        const awaited = argument === undefined ? undefined : this.resolvePath(argument);

        return awaited?.kind === "initPromise" ? GLOBAL_T : undefined;
    }

    private resolveBinding(binding: Binding): Semantic | undefined {
        const special = this.specialBindings.get(binding);

        if (special !== undefined) {
            return special;
        }

        return binding.constant ? this.resolveConstantBinding(binding) : undefined;
    }

    private resolveConstantBinding(binding: Binding): Semantic | undefined {
        const cached = this.bindingCache.get(binding);

        if (cached !== undefined) {
            return cached ?? undefined;
        }

        if (this.resolving.has(binding)) {
            return;
        }

        this.resolving.add(binding);
        const resolved = this.importSemantic(binding) ?? this.declaratorSemantic(binding);
        this.resolving.delete(binding);
        this.bindingCache.set(binding, resolved ?? null);

        return resolved;
    }

    private declaratorSemantic(binding: Binding): Semantic | undefined {
        const path = binding.path;

        if (!path.isVariableDeclarator()) {
            return;
        }

        const id = oneChild(path, "id");
        const init = oneChild(path, "init");

        if (id === undefined || init === undefined) {
            return;
        }

        if (id.isIdentifier() && id.node.name === binding.identifier.name) {
            return this.resolvePath(init);
        }

        return this.patternDeclaratorSemantic(id, init, binding.identifier.name);
    }

    private patternDeclaratorSemantic(id: NodePath, init: NodePath, name: string): Semantic | undefined {
        if (id.isObjectPattern()) {
            return this.objectPatternSemantic(id, init, name);
        }

        return id.isArrayPattern()
            ? this.arrayPatternSemantic(id, init, name)
            : undefined;
    }

    private objectPatternSemantic(id: NodePath, init: NodePath, name: string): Semantic | undefined {
        const object = this.resolvePath(init);

        if (object === undefined) {
            return;
        }

        for (const property of childPaths(id, "properties")) {
            const resolved = this.patternPropertySemantic(property, object, name);

            if (resolved !== undefined) {
                return resolved;
            }
        }

        return undefined;
    }

    private patternPropertySemantic(
        property: NodePath,
        object: Semantic,
        name: string,
    ): Semantic | undefined {
        if (!property.isObjectProperty()) {
            return;
        }

        const key = oneChild(property, "key");
        const value = oneChild(property, "value");

        if (key === undefined || value === undefined || patternLocalName(value) !== name) {
            return;
        }

        const propertyName = staticPropertyName(key);

        return propertyName === undefined ? undefined : this.semanticMember(object, propertyName);
    }

    private arrayPatternSemantic(id: NodePath, init: NodePath, name: string): Semantic | undefined {
        const object = this.resolvePath(init);

        if (object?.kind !== "translationObject") {
            return;
        }

        const elements = childPaths(id, "elements");

        if (elements[0] !== undefined && patternLocalName(elements[0]) === name) {
            return object.t;
        }

        return !object.instance && elements[1] !== undefined && patternLocalName(elements[1]) === name
            ? { instance: true, kind: "translationObject", t: GLOBAL_T }
            : undefined;
    }

    private jsxSemantic(path: NodePath): Semantic | undefined {
        if (path.isJSXIdentifier()) {
            const binding = path.scope.getBinding(path.node.name);

            return binding === undefined ? undefined : this.resolveBinding(binding);
        }

        return path.isJSXMemberExpression()
            ? this.jsxMemberSemantic(path)
            : undefined;
    }

    private jsxMemberSemantic(path: NodePath<babel.JSXMemberExpression>): Semantic | undefined {
        const object = oneChild(path, "object");
        const property = oneChild(path, "property");

        if (object === undefined || property?.isJSXIdentifier() !== true) {
            return;
        }

        const base = this.jsxSemantic(object);

        return base === undefined
            ? undefined
            : this.semanticMember(base, property.node.name);
    }

    private resolveFunction(input: NodePath | undefined): NodePath | undefined {
        if (input === undefined) {
            return;
        }

        const path = unwrapPath(input);

        if (path.isFunction() || path.isClass()) {
            return path;
        }

        if (!path.isIdentifier()) {
            return;
        }

        return this.resolveFunctionBinding(path.scope.getBinding(path.node.name));
    }

    private resolveFunctionBinding(binding: Binding | undefined): NodePath | undefined {
        if (binding?.path.isFunctionDeclaration() === true || binding?.path.isClassDeclaration() === true) {
            return binding.path;
        }

        return binding?.path.isVariableDeclarator() === true
            ? this.resolveFunction(oneChild(binding.path, "init"))
            : undefined;
    }

    private registerPatternBinding(path: NodePath, semantic: Semantic): void {
        const name = patternLocalName(path);
        const binding = name === undefined ? undefined : path.scope.getBinding(name);

        if (binding === undefined) {
            return;
        }

        const existing = this.specialBindings.get(binding);

        if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(semantic)) {
            this.errors.add(`A translation binding cannot be reused with conflicting scopes in ${this.file}`);

            return;
        }

        this.specialBindings.set(binding, semantic);
    }

    private registerSemanticPattern(path: NodePath, semantic: Semantic): void {
        const target = this.semanticPatternTarget(path);

        if (target.isIdentifier()) {
            this.registerPatternBinding(target, semantic);

            return;
        }

        if (target.isObjectPattern()) {
            this.registerObjectSemanticPattern(target, semantic);
        }
    }

    private semanticPatternTarget(path: NodePath): NodePath {
        const target = unwrapPath(path);

        return target.isAssignmentPattern()
            ? oneChild(target, "left") ?? target
            : target;
    }

    private registerObjectSemanticPattern(pattern: NodePath, semantic: Semantic): void {
        for (const property of childPaths(pattern, "properties")) {
            this.registerSemanticProperty(property, semantic);
        }
    }

    private registerSemanticProperty(property: NodePath, semantic: Semantic): void {
        if (!property.isObjectProperty()) {
            return;
        }

        const key = oneChild(property, "key");
        const value = oneChild(property, "value");
        const name = key === undefined ? undefined : staticPropertyName(key);
        const member = name === undefined ? undefined : this.semanticMember(semantic, name);

        if (value !== undefined && member !== undefined) {
            this.registerSemanticPattern(value, member);
        }
    }

    private registerTParameter(fn: NodePath, index: number, t: TSemantic): void {
        const parameter = childPaths(fn, "params")[index];

        if (parameter !== undefined) {
            this.registerPatternBinding(parameter, t);
        }
    }

    private registerHocComponent(component: NodePath | undefined, info: ScopeInfo): void {
        const target = this.resolveFunction(component);

        if (target === undefined) {
            return;
        }

        const t: TSemantic = { fixed: true, info, kind: "t" };

        if (target.isClass()) {
            this.hocClasses.set(target.node, t);

            return;
        }

        this.registerHocParameter(childPaths(target, "params")[0], t);
    }

    private registerHocParameter(parameter: NodePath | undefined, t: TSemantic): void {
        if (parameter === undefined) {
            return;
        }

        const unwrapped = unwrapPath(parameter);

        if (unwrapped.isIdentifier() || unwrapped.isAssignmentPattern()) {
            this.registerPatternBinding(unwrapped, { instance: false, kind: "translationObject", t });

            return;
        }

        if (unwrapped.isObjectPattern()) {
            this.registerHocObjectPattern(unwrapped, t);
        }
    }

    private registerHocObjectPattern(pattern: NodePath, t: TSemantic): void {
        for (const property of childPaths(pattern, "properties")) {
            this.registerHocProperty(property, t);
        }
    }

    private registerHocProperty(property: NodePath, t: TSemantic): void {
        if (!property.isObjectProperty()) {
            return;
        }

        const key = oneChild(property, "key");
        const value = oneChild(property, "value");

        if (key !== undefined && value !== undefined && staticPropertyName(key) === "t") {
            this.registerPatternBinding(value, t);
        }
    }

    private jsxAttribute(element: NodePath, name: string): NodePath | undefined {
        const opening = oneChild(element, "openingElement");

        if (opening === undefined) {
            return;
        }

        for (const attribute of childPaths(opening, "attributes").toReversed()) {
            const value = this.jsxAttributeValue(attribute, name);

            if (value !== undefined) {
                return value;
            }
        }

        return undefined;
    }

    private jsxAttributeValue(attribute: NodePath, name: string): NodePath | undefined {
        if (attribute.isJSXSpreadAttribute()) {
            return objectProperty(oneChild(attribute, "argument"), name);
        }

        if (!attribute.isJSXAttribute()) {
            return;
        }

        const attributeName = oneChild(attribute, "name");

        if (attributeName?.isJSXIdentifier() !== true || attributeName.node.name !== name) {
            return;
        }

        const value = oneChild(attribute, "value");

        return value?.isJSXExpressionContainer() === true ? oneChild(value, "expression") : value;
    }

    private scopeFromJsx(element: NodePath): ScopeInfo {
        return normalizedInfo(
            staticNamespaces(this.jsxAttribute(element, "ns"), this.file),
            staticKeyPrefix(this.jsxAttribute(element, "keyPrefix"), this.file),
        );
    }

    private addComponentMessage(input: ComponentInput): void {
        const componentKeys = this.componentKeys(input);

        if (componentKeys === undefined) {
            return;
        }

        if (!this.validateIcu(input, componentKeys)) {
            return;
        }

        const t = this.componentT(input.tPath);

        if (!t.isValid) {
            return;
        }

        const context = this.componentContext(input);

        if (!context.isValid) {
            return;
        }

        const scope = this.componentScope(input, componentKeys.rawKeys, t.value, context.value);
        this.addScopedComponentMessages(input, componentKeys, scope);
    }

    private addScopedComponentMessages(
        input: ComponentInput,
        componentKeys: ComponentKeys,
        scope: ComponentScope,
    ): void {
        if (this.componentHasCount(input)) {
            this.addPluralComponentMessages(input, componentKeys.fallback, scope);
        } else {
            this.addPointComponentMessages(input, componentKeys, scope);
        }
    }

    private componentKeys(input: ComponentInput): ComponentKeys | undefined {
        const optionDefault = objectProperty(input.optionsPath, "defaultValue");
        const fallback = literalString(input.defaultPath) ?? literalString(optionDefault);
        const explicitKeys = this.explicitComponentKeys(input.keyPath);

        if (explicitKeys === undefined) {
            return;
        }

        const rawKeys = explicitKeys.length > 0 ? explicitKeys : this.fallbackKeys(fallback);

        if (rawKeys.length === 0) {
            this.errors.add(`Translation components require a static key or default in ${this.file}`);

            return;
        }

        return { fallback, rawKeys };
    }

    private explicitComponentKeys(keyPath: NodePath | undefined): string[] | undefined {
        if (keyPath === undefined) {
            return [];
        }

        const keys = namespaceValues(keyPath);

        if (keys.length === 0) {
            this.errors.add(`Translation component keys must be static strings in ${this.file}`);

            return;
        }

        return keys;
    }

    private fallbackKeys(fallback: string | undefined): string[] {
        return fallback === undefined ? [] : [fallback];
    }

    private validateIcu(input: ComponentInput, keys: ComponentKeys): boolean {
        if (!input.isIcu) {
            return true;
        }

        if (keys.rawKeys.length > 1) {
            this.errors.add(`ICU translations require one static key in ${this.file}`);

            return false;
        }

        return this.validateIcuFallback(input, keys.fallback);
    }

    private validateIcuFallback(input: ComponentInput, fallback: string | undefined): boolean {
        if (fallback === undefined) {
            this.errors.add(`ICU translations require a static defaultTranslation in ${this.file}`);

            return false;
        }

        const withoutInterpolation = fallback.replaceAll(/\{\{[^{}]+\}\}/gu, "");

        if (/\{[^{}]+\}/u.test(withoutInterpolation)) {
            this.errors.add(`GTKX gettext catalogs do not support ICU MessageFormat syntax in ${this.file}`);

            return false;
        }

        return this.validateIcuCount(input, fallback);
    }

    private validateIcuCount(input: ComponentInput, fallback: string): boolean {
        const hasValueCount = objectProperty(input.valuesPath, "count") !== undefined;

        if (hasValueCount || /\{\{\s*count\s*\}\}/u.test(fallback)) {
            this.errors.add(`ICU translations cannot infer a GNU gettext plural pair in ${this.file}`);

            return false;
        }

        return true;
    }

    private componentT(path: NodePath | undefined): Resolution<TSemantic> {
        if (path === undefined) {
            return { isValid: true };
        }

        const semantic = this.resolvePath(path);

        if (semantic?.kind !== "t") {
            this.errors.add(`Translation component t props must have a statically known scope in ${this.file}`);

            return { isValid: false };
        }

        return { isValid: true, value: semantic };
    }

    private componentContext(input: ComponentInput): Resolution<string> {
        const optionContext = objectProperty(input.optionsPath, "context");
        const contextPath = input.contextPath ?? optionContext;

        if (contextPath === undefined) {
            return { isValid: true };
        }

        const context = literalString(contextPath);

        if (context === undefined) {
            this.errors.add(`Translation contexts must be static strings in ${this.file}`);

            return { isValid: false };
        }

        return { isValid: true, value: context };
    }

    private componentScope(
        input: ComponentInput,
        rawKeys: string[],
        t: TSemantic | undefined,
        context: string | undefined,
    ): ComponentScope {
        const prefix = t?.info.keyPrefix;
        const baseKeys = rawKeys.map((key) => prefix === undefined ? key : `${prefix}.${key}`);

        const keys = baseKeys.map((key) => context === undefined
            ? key
            : `${key}${CONTEXT_SEPARATOR}${context}`);

        const explicitNs = staticNamespaces(input.namespacePath, this.file)[0];

        return { keys, ns: explicitNs ?? t?.info.defaultNs };
    }

    private componentHasCount(input: ComponentInput): boolean {
        return input.countPath !== undefined ||
            objectProperty(input.optionsPath, "count") !== undefined ||
            objectProperty(input.valuesPath, "count") !== undefined;
    }

    private addPluralComponentMessages(
        input: ComponentInput,
        fallback: string | undefined,
        scope: ComponentScope,
    ): void {
        if (input.isIcu) {
            this.errors.add(`ICU translations cannot infer a GNU gettext plural pair in ${this.file}`);

            return;
        }

        if (this.hasUnsupportedPluralOptions(input.optionsPath)) {
            this.errors.add(`GNU gettext catalogs only support cardinal one/other source pairs in ${this.file}`);

            return;
        }

        const defaults = this.pluralDefaults(input.optionsPath, fallback);

        if (defaults === undefined) {
            return;
        }

        for (const key of scope.keys) {
            this.addPluralPair({ key, ns: scope.ns, path: input.path, ...defaults });
        }
    }

    private pluralDefaults(
        options: NodePath | undefined,
        fallback: string | undefined,
    ): Pick<PluralPairInput, "plural" | "singular"> | undefined {
        const singular = literalString(objectProperty(options, "defaultValue_one")) ?? fallback;
        const plural = literalString(objectProperty(options, "defaultValue_other"));

        if (singular === undefined || plural === undefined || singular === plural) {
            this.errors.add(
                `Count-based Trans calls require distinct static singular and plural defaults in ${this.file}`,
            );

            return;
        }

        return { plural, singular };
    }

    private hasUnsupportedPluralOptions(options: NodePath | undefined): boolean {
        return objectProperty(options, "ordinal") !== undefined ||
            objectProperty(options, "defaultValue_zero") !== undefined;
    }

    private addPluralPair(input: PluralPairInput): void {
        this.addMessage({
            defaultValue: input.singular,
            hasExplicitDefault: true,
            key: `${input.key}_one`,
            ns: input.ns,
            path: input.path,
        });

        this.addMessage({
            defaultValue: input.plural,
            hasExplicitDefault: true,
            key: `${input.key}_other`,
            ns: input.ns,
            path: input.path,
        });
    }

    private addPointComponentMessages(
        input: ComponentInput,
        componentKeys: ComponentKeys,
        scope: ComponentScope,
    ): void {
        for (const [index, key] of scope.keys.entries()) {
            const defaultValue = componentKeys.fallback ?? componentKeys.rawKeys[index] ?? key;

            this.addMessage({
                defaultValue,
                hasExplicitDefault: componentKeys.fallback !== undefined,
                key,
                ns: scope.ns,
                path: input.path,
            });
        }
    }

    private addMessage(input: MessageInput): void {
        this.messages.push({
            defaultValue: input.defaultValue,
            explicitDefault: input.hasExplicitDefault,
            key: input.key,
            location: pathLocation(input.path, this.file),
            ...(input.ns !== undefined && { ns: input.ns }),
        });
    }

    private markTranslationCallback(callback: NodePath | undefined, info: ScopeInfo): void {
        const fn = this.resolveFunction(callback);

        if (fn !== undefined && !fn.isClass()) {
            this.registerTParameter(fn, 0, { fixed: true, info, kind: "t" });
            this.registerTranslationContextParameter(fn);
        }
    }

    private registerTranslationContextParameter(fn: NodePath): void {
        const parameter = childPaths(fn, "params")[1];

        if (parameter !== undefined) {
            this.registerSemanticPattern(parameter, { kind: "translationContext" });
        }
    }

    private registerCallSemantics(path: NodePath): void {
        const callee = oneChild(path, "callee");
        const called = callee === undefined ? undefined : this.resolvePath(callee);
        this.registerHocCall(path, called);
        this.registerTranslationCallbackCall(path, called);
        this.registerInitCallback(path, called);
        this.registerInitPromiseCallback(path, callee);
        this.registerCallableComponent(path, called);
    }

    private registerHocCall(path: NodePath, called: Semantic | undefined): void {
        if (called?.kind === "enhancer") {
            this.registerHocComponent(callArguments(path)[0], called.info);
        }
    }

    private registerTranslationCallbackCall(path: NodePath, called: Semantic | undefined): void {
        if (called?.kind !== "api" || called.api !== "Translation") {
            return;
        }

        const props = callArguments(path)[0];

        const info = normalizedInfo(
            staticNamespaces(objectProperty(props, "ns"), this.file),
            staticKeyPrefix(objectProperty(props, "keyPrefix"), this.file),
        );

        this.markTranslationCallback(objectProperty(props, "children"), info);
    }

    private registerInitCallback(path: NodePath, called: Semantic | undefined): void {
        if (called?.kind !== "api" || called.api !== "init") {
            return;
        }

        const callback = callArguments(path).findLast((argument) => this.resolveFunction(argument) !== undefined);
        const fn = this.resolveFunction(callback);

        if (fn !== undefined && !fn.isClass()) {
            this.registerTParameter(fn, 1, GLOBAL_T);
        }
    }

    private registerInitPromiseCallback(path: NodePath, callee: NodePath | undefined): void {
        if (callee === undefined) {
            return;
        }

        if (memberProperty(callee) !== "then") {
            return;
        }

        const receiver = oneChild(unwrapPath(callee), "object");
        const received = receiver === undefined ? undefined : this.resolvePath(receiver);

        if (received?.kind !== "initPromise") {
            return;
        }

        this.registerInitPromiseFunction(this.resolveFunction(callArguments(path)[0]));
    }

    private registerInitPromiseFunction(fn: NodePath | undefined): void {
        if (fn === undefined || fn.isClass()) {
            return;
        }

        this.registerTParameter(fn, 0, GLOBAL_T);
    }

    private registerCallableComponent(path: NodePath, called: Semantic | undefined): void {
        if (called?.kind !== "api") {
            return;
        }

        if (["IcuTrans", "IcuTransWithoutContext"].includes(called.api)) {
            this.addComponentMessage(this.callableIcuInput(path));
        }

        if (["Trans", "TransWithoutContext"].includes(called.api)) {
            this.addComponentMessage(this.callableTransInput(path));
        }
    }

    private callableIcuInput(path: NodePath): ComponentInput {
        const props = callArguments(path)[0];

        return {
            defaultPath: objectProperty(props, "defaultTranslation"),
            isIcu: true,
            keyPath: objectProperty(props, "i18nKey"),
            namespacePath: objectProperty(props, "ns"),
            path,
            tPath: objectProperty(props, "t"),
            valuesPath: objectProperty(props, "values"),
        };
    }

    private callableTransInput(path: NodePath): ComponentInput {
        const props = callArguments(path)[0];

        return {
            contextPath: objectProperty(props, "context"),
            countPath: objectProperty(props, "count"),
            defaultPath: objectProperty(props, "defaults") ?? objectProperty(props, "children"),
            isIcu: false,
            keyPath: objectProperty(props, "i18nKey"),
            namespacePath: objectProperty(props, "ns"),
            optionsPath: objectProperty(props, "tOptions"),
            path,
            tPath: objectProperty(props, "t"),
            valuesPath: objectProperty(props, "values"),
        };
    }

    private registerBlockedGetFixedT(path: NodePath): void {
        const callee = this.possibleGetFixedCallee(path);

        if (callee === undefined) {
            return;
        }

        const semantic = this.resolvePath(callee);

        if (this.isGetFixedApi(semantic)) {
            return;
        }

        const key = spanKey(path.node);

        if (key !== undefined) {
            this.blockedGetFixedT.add(key);
        }
    }

    private possibleGetFixedCallee(path: NodePath): NodePath | undefined {
        const init = oneChild(path, "init");

        if (!init?.isCallExpression()) {
            return;
        }

        const callee = oneChild(init, "callee");

        return callee !== undefined && memberProperty(callee) === "getFixedT"
            ? callee
            : undefined;
    }

    private isGetFixedApi(semantic: Semantic | undefined): boolean {
        return semantic?.kind === "api" && semantic.api === "getFixedT";
    }

    private registerJsxElement(path: NodePath): void {
        const opening = oneChild(path, "openingElement");
        const name = opening === undefined ? undefined : oneChild(opening, "name");
        const component = name === undefined ? undefined : this.jsxSemantic(name);

        if (opening === undefined || component?.kind !== "api") {
            return;
        }

        this.registerApiJsx(path, opening, component.api);
    }

    private registerApiJsx(path: NodePath, opening: NodePath, api: ApiName): void {
        if (["Trans", "TransWithoutContext"].includes(api)) {
            this.registerTransJsx(path, opening);

            return;
        }

        if (api === "Translation") {
            this.registerTranslationJsx(path);

            return;
        }

        if (["IcuTrans", "IcuTransWithoutContext"].includes(api)) {
            this.addComponentMessage(this.jsxIcuInput(path));
        }
    }

    private registerTransJsx(path: NodePath, opening: NodePath): void {
        if (!this.validateTransJsxProps(path, opening)) {
            return;
        }

        const key = spanKey(path.node);

        if (key === undefined) {
            return;
        }

        const scope = this.transJsxScope(path);

        if (!scope.isValid) {
            return;
        }

        this.trans.set(key, scope.value ?? null);
    }

    private validateTransJsxProps(path: NodePath, opening: NodePath): boolean {
        const hasSpread = childPaths(opening, "attributes").some((attribute) => attribute.isJSXSpreadAttribute());

        if (hasSpread) {
            this.errors.add(`Trans JSX props must be written explicitly for static extraction in ${this.file}`);

            return false;
        }

        if (isStaticStringArray(this.jsxAttribute(path, "i18nKey"))) {
            this.errors.add(`Trans JSX i18nKey arrays are not supported by static extraction in ${this.file}`);

            return false;
        }

        return true;
    }

    private transJsxScope(path: NodePath): Resolution<ScopeInfo> {
        const tProp = this.jsxAttribute(path, "t");

        if (tProp === undefined) {
            return { isValid: true };
        }

        const semantic = this.resolvePath(tProp);

        if (semantic?.kind !== "t") {
            this.errors.add(`Trans t props must have a statically known scope in ${this.file}`);

            return { isValid: false };
        }

        if (!this.validatePrefixedTransNamespace(path, semantic)) {
            return { isValid: false };
        }

        return { isValid: true, value: semantic.info };
    }

    private validatePrefixedTransNamespace(path: NodePath, t: TSemantic): boolean {
        if (t.info.keyPrefix === undefined || this.jsxAttribute(path, "ns") === undefined) {
            return true;
        }

        this.errors.add(`Prefixed Trans components cannot also override ns during static extraction in ${this.file}`);

        return false;
    }

    private registerTranslationJsx(path: NodePath): void {
        const info = this.scopeFromJsx(path);
        this.markTranslationCallback(this.jsxAttribute(path, "children"), info);

        for (const child of childPaths(path, "children")) {
            if (child.isJSXExpressionContainer()) {
                this.markTranslationCallback(oneChild(child, "expression"), info);
            }
        }
    }

    private jsxIcuInput(path: NodePath): ComponentInput {
        return {
            defaultPath: this.jsxAttribute(path, "defaultTranslation"),
            isIcu: true,
            keyPath: this.jsxAttribute(path, "i18nKey"),
            namespacePath: this.jsxAttribute(path, "ns"),
            path,
            tPath: this.jsxAttribute(path, "t"),
            valuesPath: this.jsxAttribute(path, "values"),
        };
    }

    private classT(callee: NodePath): TSemantic | undefined {
        if (memberProperty(callee) !== "t") {
            return;
        }

        const object = oneChild(unwrapPath(callee), "object");

        if (object === undefined || memberProperty(object) !== "props") {
            return;
        }

        const receiver = oneChild(unwrapPath(object), "object");

        if (receiver?.isThisExpression() !== true) {
            return;
        }

        const owner = callee.findParent(isClassPath);

        return owner === null ? undefined : this.hocClasses.get(owner.node);
    }

    private optionsKeyPrefix(call: NodePath): NodePath | undefined {
        for (const argument of callArguments(call).slice(1)) {
            const keyPrefix = objectProperty(argument, "keyPrefix");

            if (keyPrefix !== undefined) {
                return keyPrefix;
            }
        }

        return undefined;
    }

    private registerTranslationCall(path: NodePath): void {
        const callee = oneChild(path, "callee");

        if (callee === undefined) {
            return;
        }

        const resolved = this.resolvePath(callee);
        const t = resolved?.kind === "t" ? resolved : this.classT(callee);
        const key = spanKey(path.node);

        if (t === undefined || key === undefined) {
            return;
        }

        const info = this.translationCallScope(path, t);

        if (info !== undefined) {
            this.calls.set(key, { info, key });
        }
    }

    private translationCallScope(path: NodePath, t: TSemantic): ScopeInfo | undefined {
        const keyPrefix = this.optionsKeyPrefix(path);

        if (keyPrefix === undefined) {
            return t.info;
        }

        const literalPrefix = literalString(keyPrefix);

        if (literalPrefix === undefined) {
            this.errors.add(`Translation keyPrefix options must be static strings in ${this.file}`);

            return;
        }

        if (!t.fixed) {
            this.errors.add(`keyPrefix options require a fixed translation function in ${this.file}`);

            return;
        }

        return scopeWithPrefix(t.info, literalPrefix);
    }

    private registerTaggedTranslation(path: NodePath): void {
        const tag = oneChild(path, "tag");
        const resolved = tag === undefined ? undefined : this.resolvePath(tag);

        if (resolved?.kind === "t") {
            this.errors.add(
                `Tagged-template translations are not compatible with strict GTKX codegen in ${this.file}`,
            );
        }
    }

    analyze(program: NodePath): BindingExtraction {
        this.runSemanticPass(program);
        this.bindingCache.clear();
        this.runTranslationPass(program);

        return {
            blockedGetFixedT: this.blockedGetFixedT,
            calls: this.calls,
            errors: [...this.errors],
            messages: this.messages,
            trans: this.trans,
        };
    }
}

export { type BindingExtraction, type ScopeInfo, extractBindings };
