import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;

export const addRow = css`
    background: alpha(@accent_bg_color, 0.08);
`;

export const dueLabel = css`
    font-size: 0.9em;
`;

export const detailNotes = css`
    padding: 6px;
    min-height: 160px;
`;
