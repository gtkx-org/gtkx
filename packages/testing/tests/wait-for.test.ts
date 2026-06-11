import { describe, expect, it, vi } from "vitest";
import { waitFor, waitForElementToBeRemoved } from "../src/wait-for.js";

describe("waitFor success", () => {
    it("resolves immediately when callback succeeds", async () => {
        const result = await waitFor(() => "success");
        expect(result).toBe("success");
    });

    it("returns the callback return value", async () => {
        const result = await waitFor(() => ({ foo: "bar" }));
        expect(result).toEqual({ foo: "bar" });
    });

    it("retries until callback succeeds", async () => {
        let attempts = 0;
        const result = await waitFor(() => {
            attempts++;
            if (attempts < 3) throw new Error("Not ready");
            return "done";
        });
        expect(result).toBe("done");
        expect(attempts).toBe(3);
    });

    it("handles async callbacks", async () => {
        let attempts = 0;
        const result = await waitFor(async () => {
            attempts++;
            await new Promise((r) => setTimeout(r, 5));
            if (attempts < 2) throw new Error("Not ready");
            return "async success";
        });
        expect(result).toBe("async success");
    });
});

describe("waitFor timeout", () => {
    it("throws timeout error when callback never succeeds", async () => {
        await expect(
            waitFor(
                () => {
                    throw new Error("Always fails");
                },
                { timeout: 100, interval: 10 },
            ),
        ).rejects.toThrow(/Timed out after 100ms/);
    });

    it("includes last error message in timeout error", async () => {
        await expect(
            waitFor(
                () => {
                    throw new Error("Specific failure reason");
                },
                { timeout: 100, interval: 10 },
            ),
        ).rejects.toThrow(/Specific failure reason/);
    });

    it("uses custom interval", async () => {
        let attempts = 0;
        const start = Date.now();

        await expect(
            waitFor(
                () => {
                    attempts++;
                    throw new Error("fail");
                },
                { timeout: 300, interval: 50 },
            ),
        ).rejects.toThrow();

        const elapsed = Date.now() - start;
        expect(attempts).toBeGreaterThanOrEqual(2);
        expect(attempts).toBeLessThanOrEqual(10);
        expect(elapsed).toBeGreaterThanOrEqual(280);
    });

    it("calls onTimeout callback when provided", async () => {
        const customError = new Error("Custom timeout message");
        const onTimeout = vi.fn().mockReturnValue(customError);

        await expect(
            waitFor(
                () => {
                    throw new Error("fail");
                },
                { timeout: 100, interval: 10, onTimeout },
            ),
        ).rejects.toThrow("Custom timeout message");

        expect(onTimeout).toHaveBeenCalledTimes(1);
        expect(onTimeout).toHaveBeenCalledWith(expect.any(Error));
    });
});

const createMockWidget = (hasRoot: boolean) => ({
    getRoot: () => (hasRoot ? {} : null),
});

describe("waitForElementToBeRemoved preconditions", () => {
    it("throws if element is already removed", async () => {
        const element = createMockWidget(false);

        await expect(waitForElementToBeRemoved(element as never)).rejects.toThrow(
            "Element already removed: waitForElementToBeRemoved requires the element to be present initially",
        );
    });

    it("throws if callback returns null initially", async () => {
        await expect(waitForElementToBeRemoved(() => null as never)).rejects.toThrow(
            "Element already removed: waitForElementToBeRemoved requires the element to be present initially",
        );
    });
});

describe("waitForElementToBeRemoved success", () => {
    it("resolves when element is removed", async () => {
        let hasRoot = true;
        const element = {
            getRoot: () => (hasRoot ? {} : null),
        };

        setTimeout(() => {
            hasRoot = false;
        }, 50);

        await expect(
            waitForElementToBeRemoved(element as never, { timeout: 500, interval: 10 }),
        ).resolves.toBeUndefined();
    });

    it("resolves when callback returns null", async () => {
        let element: object | null = { getRoot: () => ({}) };

        setTimeout(() => {
            element = null;
        }, 50);

        await expect(
            waitForElementToBeRemoved(() => element as never, { timeout: 500, interval: 10 }),
        ).resolves.toBeUndefined();
    });

    it("handles getRoot throwing error as removed", async () => {
        let shouldThrow = false;
        const element = {
            getRoot: () => {
                if (shouldThrow) throw new Error("Widget destroyed");
                return {};
            },
        };

        setTimeout(() => {
            shouldThrow = true;
        }, 50);

        await expect(
            waitForElementToBeRemoved(element as never, { timeout: 500, interval: 10 }),
        ).resolves.toBeUndefined();
    });
});

describe("waitForElementToBeRemoved timeout", () => {
    it("times out if element is never removed", async () => {
        const element = createMockWidget(true);

        await expect(waitForElementToBeRemoved(element as never, { timeout: 100, interval: 10 })).rejects.toThrow(
            /Timed out after 100ms waiting for element to be removed/,
        );
    });

    it("calls onTimeout callback when provided", async () => {
        const element = createMockWidget(true);
        const customError = new Error("Custom removal timeout");
        const onTimeout = vi.fn().mockReturnValue(customError);

        await expect(
            waitForElementToBeRemoved(element as never, { timeout: 100, interval: 10, onTimeout }),
        ).rejects.toThrow("Custom removal timeout");

        expect(onTimeout).toHaveBeenCalledTimes(1);
    });
});
