import { css } from "@gtkx/css";

const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;

const detailNotes = css`
    padding: 6px;
    min-height: 160px;
`;

export {
    detailNotes,
    listDot,
};
