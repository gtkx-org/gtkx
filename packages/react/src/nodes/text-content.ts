import type { TextAnchorNode } from "./text-anchor.js";
import type { TextPaintableNode } from "./text-paintable.js";
import type { TextSegmentNode } from "./text-segment.js";
import type { TextTagNode } from "./text-tag.js";

export const TEXT_OBJECT_REPLACEMENT = "￼";

export type TextContentChild = TextSegmentNode | TextTagNode | TextAnchorNode | TextPaintableNode;

export type TextContentParent = {
    onChildInserted(child: TextContentChild): void;
    onChildRemoved(child: TextContentChild): void;
    onChildTextChanged(child: TextSegmentNode, oldLength: number): void;
};
