import { describe, expect, it } from "vitest";
import { gtkxReactDomPrebundle } from "../../src/vite-plugins/react-dom-prebundle.js";

type ConfigHook = (config: { optimizeDeps?: { include?: string[] } }) => void;

const getConfigHook = (): ConfigHook => {
    const plugin = gtkxReactDomPrebundle();
    const hook = plugin.config;

    if (typeof hook !== "function") {
        throw new TypeError("expected plugin.config to be a function");
    }

    return hook as ConfigHook;
};

describe("gtkxReactDomPrebundle", () => {
    it("has the canonical plugin name and post enforcement", () => {
        const plugin = gtkxReactDomPrebundle();
        expect(plugin.name).toBe("gtkx:react-dom-prebundle");
        expect(plugin.enforce).toBe("post");
    });

    it("filters react-dom and react-dom/* entries out of optimizeDeps.include", () => {
        const config: { optimizeDeps?: { include?: string[] } } = {
            optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lodash"] },
        };

        getConfigHook()(config);
        expect(config.optimizeDeps?.include).toEqual(["react", "lodash"]);
    });

    it("initializes optimizeDeps when missing and leaves include unset", () => {
        const config: { optimizeDeps?: { include?: string[] } } = {};
        getConfigHook()(config);
        expect(config.optimizeDeps).toEqual({ include: undefined });
    });

    it("leaves include unchanged when no react-dom entries are present", () => {
        const config: { optimizeDeps?: { include?: string[] } } = {
            optimizeDeps: { include: ["react", "lodash"] },
        };

        getConfigHook()(config);
        expect(config.optimizeDeps?.include).toEqual(["react", "lodash"]);
    });
});
