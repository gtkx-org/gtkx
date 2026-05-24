import gtkx from "@gtkx/vitest";
import { defineConfig, type Plugin } from "vitest/config";

const ASSET_RE =
    /\.(?:png|jpg|jpeg|gif|svg|webp|webm|mp4|ogg|mp3|wav|flac|aac|woff|woff2|eot|ttf|otf|ico|avif|data|txt|gpa)$/i;

/**
 * Test-time asset resolver: returns absolute file paths for asset imports so
 * GdkPixbuf and other FFI consumers can read them off disk. Mirrors the
 * dev-mode behavior of the production `gtkxAssets` Vite plugin.
 */
const assetResolver = (): Plugin => ({
    name: "gtk-demo:test-assets",
    enforce: "pre",
    config: () => ({ assetsInclude: [ASSET_RE] }),
    load(id) {
        if (!ASSET_RE.test(id)) return;
        return `export default ${JSON.stringify(id)};`;
    },
});

export default defineConfig({
    plugins: [assetResolver(), gtkx()],
    test: {
        name: "gtk-demo",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.d.ts", "src/demos/types.ts", "src/demos/opengl/**", "src/demos/media/video-player.tsx"],
            reporter: ["text", "html", "lcov"],
            thresholds: {
                lines: 75,
                statements: 75,
                functions: 75,
            },
        },
    },
});
