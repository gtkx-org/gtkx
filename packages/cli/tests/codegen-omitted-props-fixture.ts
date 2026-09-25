const OMITTED_PROPS_MODULE = "@audit/omitted-props";
const OMITTED_PROPS_OUTPUT = "docs/reference";
const DECLARATIONS = `export type BranchProps =
    { kind: "text"; text: string } | { kind: "count"; count: number };
export interface ReplacementProps { label?: number; onNotifyLabel?: (value: number) => void; }
export interface EditableExtras { text?: string; onNotifyText?: () => void; extra?: boolean; }
`;

const omittedPropsConfig = (elements: Record<string, object>, options: object = {}): string =>
    `export default ${JSON.stringify({
        applicationId: "org.gtkx.omittedprops",
        agents: { reference: false, rules: false },
        elements: { config: elements },
        ...options,
    })};\n`;

const omittedPropsFixtureFiles = {
    [`node_modules/${OMITTED_PROPS_MODULE}/package.json`]: JSON.stringify({
        name: OMITTED_PROPS_MODULE,
        version: "1.0.0",
        type: "module",
        exports: { ".": { types: "./index.d.ts" } },
    }),
    [`node_modules/${OMITTED_PROPS_MODULE}/index.d.ts`]: DECLARATIONS,
};

export {
    OMITTED_PROPS_MODULE,
    OMITTED_PROPS_OUTPUT,
    omittedPropsConfig,
    omittedPropsFixtureFiles,
};
