import { cognitiveComplexity } from "../src/rules/cognitive-complexity.js";
import { createRuleTester } from "./rule-tester.js";

const hookWithClosures = `
const useDropDownSelection = (options) => {
    const applyUpdate = useCallback(() => {
        applying.current = true;
        try {
            model.update({ items, sections });
        } finally {
            applying.current = false;
        }
    }, [model, items, sections]);
    const syncKnownSelection = useCallback((position) => {
        const effectiveId = model.idAt(position);
        if (effectiveId === null) {
            known.current = null;
            return;
        }
        updateKnownSelection({ known, latest }, effectiveId, selectedId);
    }, [model, selectedId, latest]);
    useLayoutEffect(() => {
        if (widget === null) return;
        applyUpdate();
        const position = resolvePosition(widget, model, selectedId);
        setSelected(position);
        syncKnownSelection(position);
    }, [widget, model, selectedId]);
    const reportSelection = useCallback(() => {
        if (widget === null || applying.current) return;
        const position = widget.getSelected();
        setSelected(position);
        reportKnownSelection({ known, latest }, model.idAt(position));
    }, [widget, model, latest]);
    return selected;
};
`;

const ruleTester = createRuleTester();

ruleTester.run("cognitive-complexity", cognitiveComplexity, {
    valid: [
        { code: "const f = (a) => (a ? 1 : 2);", options: [{ max: 1 }] },
        { code: "function f(a, b) { if (a && b) return 1; return 0; }", options: [{ max: 2 }] },
        { code: "const f = () => { const g = () => {}; return g; };", options: [{ max: 0 }] },
        { code: hookWithClosures, options: [{ max: 7 }] },
    ],
    invalid: [
        {
            code:
                "function outer(a, b) { const inner = () => { if (a) { if (b) return 1; } return 0; }; " +
                "return inner(); }",
            options: [{ max: 4 }],
            errors: [{ messageId: "excessiveComplexity", data: { complexity: 5, max: 4 } }],
        },
        {
            code:
                "function outer(a) { const x = () => { if (a) return 1; return 0; }; " +
                "const y = () => { if (a) return 1; return 0; }; return x() + y(); }",
            options: [{ max: 3 }],
            errors: [{ messageId: "excessiveComplexity", data: { complexity: 4, max: 3 } }],
        },
        {
            code: "function f(a, b, c) { if (a) { return 1; } else if (b) { if (c) { return 2; } } return 0; }",
            options: [{ max: 3 }],
            errors: [{ messageId: "excessiveComplexity", data: { complexity: 4, max: 3 } }],
        },
        {
            code: "function f(a) { outer: for (const x of a) { if (x) break outer; } return a; }",
            options: [{ max: 3 }],
            errors: [{ messageId: "excessiveComplexity", data: { complexity: 4, max: 3 } }],
        },
        {
            code: "function f(a, b, c) { if (a && b || c) return 1; return 0; }",
            options: [{ max: 2 }],
            errors: [{ messageId: "excessiveComplexity", data: { complexity: 3, max: 2 } }],
        },
        {
            code: hookWithClosures,
            options: [{ max: 6 }],
            errors: [{ messageId: "excessiveComplexity", data: { complexity: 7, max: 6 } }],
        },
    ],
});
