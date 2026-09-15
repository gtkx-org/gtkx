import { attr, getDoc, getDocDeprecated, isAttrTrue, nameAttr, type RawNode } from "./parse.js";

type GirAnnotations = {
    since: string | undefined;
    isDeprecated: boolean;
    deprecatedSince: string | undefined;
    deprecationDoc: string | undefined;
};

type DocumentedNode = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
};

const annotationsFromNode = (node: RawNode | undefined): GirAnnotations => ({
    since: attr(node, "version"),
    isDeprecated: isAttrTrue(node, "deprecated"),
    deprecatedSince: attr(node, "deprecated-version"),
    deprecationDoc: getDocDeprecated(node),
});

const documentedFromNode = (node: RawNode): DocumentedNode => ({
    name: nameAttr(node),
    doc: getDoc(node),
    annotations: annotationsFromNode(node),
});

const hasAnnotations = (annotations: GirAnnotations): boolean =>
    annotations.since !== undefined || annotations.isDeprecated || annotations.deprecatedSince !== undefined;

export { documentedFromNode, hasAnnotations, type GirAnnotations };
