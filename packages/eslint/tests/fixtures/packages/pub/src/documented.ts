/** A small label attached to a widget. */
type Badge = {
    /** Text shown inside the badge. */
    text: string;
};

/** Builds a badge showing the given text. */
function makeBadge(text: string): Badge {
    return { text };
}

export { type Badge, makeBadge };
