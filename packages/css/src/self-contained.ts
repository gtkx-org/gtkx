const SEGMENT = /\/\*.*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\\./gs;
const UNCLOSED = /\/\*|["']/;
const NON_BRACKET = /[^()[\]{}]/g;
const CLOSER_BY_OPENER: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

const didTakeBracket = (stack: string[], bracket: string): boolean => {
    const closer = CLOSER_BY_OPENER[bracket];

    if (closer === undefined) {
        return stack.pop() === bracket;
    }

    stack.push(closer);

    return true;
};

const hasBalancedBrackets = (text: string): boolean => {
    const stack: string[] = [];

    for (const bracket of text.replaceAll(NON_BRACKET, "")) {
        if (!didTakeBracket(stack, bracket)) {
            return false;
        }
    }

    return stack.length === 0;
};

const isSelfContained = (rule: string): boolean => {
    const residue = rule.replaceAll(SEGMENT, " ");

    return !UNCLOSED.test(residue) && hasBalancedBrackets(residue);
};

export { isSelfContained };
