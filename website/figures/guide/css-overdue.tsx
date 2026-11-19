import { css } from "@gtkx/css";
import { GtkLabel } from "@gtkx/jsx/gtk";

const overdue = css`
    color: var(--error-color);
    font-weight: 700;

    &:hover {
        text-decoration: underline;
    }
`;

export const DueLabel = () => (
    <GtkLabel label="Overdue" cssClasses={[overdue]} />
);
