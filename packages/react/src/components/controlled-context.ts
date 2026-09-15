import { type Context, createContext } from "react";

type ControlledChildren = { typeName: string; notify: () => void };

const ControlledChildrenContext: Context<ControlledChildren | null> = createContext<ControlledChildren | null>(null);

export { ControlledChildrenContext };
