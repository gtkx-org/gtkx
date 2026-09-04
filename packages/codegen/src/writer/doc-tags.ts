type JsDocParam = { name: string; doc: string };
type JsDocDeprecation = { since: string | undefined; doc: string | undefined };

type JsDocSpec = {
    params?: JsDocParam[];
    returns?: string | undefined;
    throws?: string | undefined;
    deprecated?: JsDocDeprecation | undefined;
    since?: string | undefined;
    identifiers?: Map<string, string> | undefined;
};

type DocConverter = (text: string) => string;

type DocConverters = {
    description: DocConverter;
    value: DocConverter;
};

const WHITESPACE_RUN_PATTERN = /\s+/g;
const PICTURE_PATTERN = /<picture[\s\S]*?<\/picture>/g;
const VIDEO_PATTERN = /<video[\s\S]*?(?:<\/video>|\/>)/g;
const IMAGE_PATTERN = /<img[^>]*>/g;

const stripDocMedia = (markdown: string): string =>
    markdown.replaceAll(PICTURE_PATTERN, "").replaceAll(VIDEO_PATTERN, "").replaceAll(IMAGE_PATTERN, "");

const flatten = (text: string, convert: DocConverter): string =>
    convert(text).replaceAll(WHITESPACE_RUN_PATTERN, " ").trim();

const paramLines = (params: JsDocParam[] | undefined, convert: DocConverter): string[] =>
    (params ?? [])
        .map((param) => ({ name: param.name, text: flatten(param.doc, convert) }))
        .filter((entry) => entry.text.length > 0)
        .map((entry) => `@param ${entry.name} ${entry.text}`);

const returnsLines = (returns: string | undefined, convert: DocConverter): string[] => {
    const text = convert(returns ?? "").trim();

    return text.length === 0 ? [] : `@returns ${text}`.split("\n");
};

const simpleTagLine = (tag: string, value: string | undefined, convert: DocConverter): string[] => {
    const text = flatten(value ?? "", convert);

    return text.length === 0 ? [] : [`${tag} ${text}`];
};

const sinceClause = (since: string | undefined): string =>
    since === undefined || since.length === 0 ? "" : `Since ${since}.`;

const deprecatedText = (deprecation: JsDocDeprecation, convert: DocConverter): string =>
    [sinceClause(deprecation.since), flatten(deprecation.doc ?? "", convert)]
        .filter((part) => part.length > 0)
        .join(" ");

const deprecatedLine = (deprecation: JsDocDeprecation | undefined, convert: DocConverter): string[] => {
    if (deprecation === undefined) {
        return [];
    }

    const text = deprecatedText(deprecation, convert);

    return [text.length === 0 ? "@deprecated" : `@deprecated ${text}`];
};

const renderDocTagLines = (spec: JsDocSpec, converters: DocConverters): string[] => [
    ...paramLines(spec.params, converters.value),
    ...returnsLines(spec.returns, converters.value),
    ...simpleTagLine("@throws", spec.throws, converters.description),
    ...deprecatedLine(spec.deprecated, converters.description),
    ...simpleTagLine("@since", spec.since, converters.description),
];

export {
    type DocConverters,
    renderDocTagLines,
    stripDocMedia,
    type JsDocDeprecation,
    type JsDocParam,
    type JsDocSpec,
};
