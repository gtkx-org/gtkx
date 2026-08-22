type PureAnnotation = {
    text: string;
    annotated: number;
};

const PURE_ANNOTATION = "/* @__PURE__ */ ";
const PURE_CALL = /(?<![\w$.])(?:t\.[A-Za-z_$][\w$]*|createErrorDomain)\(/gu;

const annotateOnce = (text: string): PureAnnotation => {
    const parts: string[] = [];
    let cursor = 0;
    let annotated = 0;

    for (const match of text.matchAll(PURE_CALL)) {
        if (text.startsWith(PURE_ANNOTATION, match.index - PURE_ANNOTATION.length)) {
            continue;
        }

        parts.push(text.slice(cursor, match.index), PURE_ANNOTATION);
        cursor = match.index;
        annotated += 1;
    }

    parts.push(text.slice(cursor));

    return { text: parts.join(""), annotated };
};

const countPureCalls = (text: string): number => text.match(PURE_CALL)?.length ?? 0;

const annotatePureCalls = (text: string): PureAnnotation => {
    let output = text;
    let annotated = 0;

    for (let pass = annotateOnce(output); pass.annotated > 0; pass = annotateOnce(output)) {
        output = pass.text;
        annotated += pass.annotated;
    }

    return { text: output, annotated };
};

export { annotatePureCalls, countPureCalls };
