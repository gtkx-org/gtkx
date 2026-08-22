import { type Context, createContext } from "react";

const DrawerCollapsedContext: Context<boolean> = createContext(false);

export { DrawerCollapsedContext };
