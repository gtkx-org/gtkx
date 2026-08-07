import { attr, getDoc, getDocDeprecated, isAttrTrue, nameAttr, type RawNode } from "./parse.js";

/** Release and deprecation annotations GIR carries on a documentable element. */
type GirAnnotations = {
    /** Library release the symbol appeared in, from the `version` attribute. */
    since: string | undefined;
    /** Whether GIR marks the symbol deprecated. */
    isDeprecated: boolean;
    /** Release the symbol was deprecated in, from the `deprecated-version` attribute. */
    deprecatedSince: string | undefined;
    /** Prose from `<doc-deprecated>` naming what to use instead. */
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

export { annotationsFromNode, documentedFromNode, hasAnnotations, type GirAnnotations };
