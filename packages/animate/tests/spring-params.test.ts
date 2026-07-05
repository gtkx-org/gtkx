import { describe, expect, it } from "vitest";
import { resolveSpringParams } from "../src/spring-params.js";

describe("resolveSpringParams", () => {
    it("clamps dampingRatio to the 0.05 floor", () => {
        const params = resolveSpringParams({ type: "spring", dampingRatio: 0.01 });

        expect(params.getDampingRatio()).toBeCloseTo(0.05, 4);
        expect(params.getStiffness()).toBe(100);
        expect(params.getMass()).toBe(1);
    });

    it("raises an explicit damping below the critical floor", () => {
        const params = resolveSpringParams({ type: "spring", stiffness: 200, damping: 1, mass: 1 });

        expect(params.getDamping()).toBeCloseTo(Math.SQRT2, 4);
        expect(params.getStiffness()).toBe(200);
    });

    it("keeps an explicit damping above the critical floor", () => {
        const params = resolveSpringParams({ type: "spring", stiffness: 100, damping: 50, mass: 1 });

        expect(params.getDamping()).toBe(50);
        expect(params.getStiffness()).toBe(100);
    });

    it("uses motion's default physics for a bare spring", () => {
        const params = resolveSpringParams({ type: "spring" });

        expect(params.getStiffness()).toBe(100);
        expect(params.getDamping()).toBe(10);
        expect(params.getMass()).toBe(1);
    });

    it("derives stiffness and damping from visualDuration and bounce", () => {
        const params = resolveSpringParams({ type: "spring", visualDuration: 0.3, bounce: 0.3 });

        expect(params.getStiffness()).toBeCloseTo(304.617, 2);
        expect(params.getDamping()).toBeCloseTo(24.435, 2);
        expect(params.getMass()).toBe(1);
    });

    it("derives a spring from duration and bounce instead of defaulting stiffness to 100", () => {
        const params = resolveSpringParams({ type: "spring", duration: 0.5, bounce: 0.3 });

        expect(params.getStiffness()).toBeCloseTo(387.275, 1);
        expect(params.getDamping()).toBeCloseTo(27.551, 1);
    });
});
