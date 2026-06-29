const RELATIONSHIP_NODE: unique symbol = Symbol.for("gtkx.relationshipNode");

export type RelationshipNode = { [RELATIONSHIP_NODE]: true };

export const createRelationshipNode = (): RelationshipNode => ({ [RELATIONSHIP_NODE]: true });

export const isRelationshipNode = (value: unknown): value is RelationshipNode =>
    typeof value === "object" && value !== null && RELATIONSHIP_NODE in value;
