import type {
    AttachRule,
    Call,
    CompanionRule,
    ContainerProp,
    ManyContainerProp,
    OneContainerProp,
    PropertyRef,
} from "./rule-validation.js";

const setTargetCall = (target: Call | PropertyRef): Call | undefined => {
    if (typeof target === "string") return target;
    if ("method" in target) return target;
    return undefined;
};

const applyManyToAttach = (rule: AttachRule, cp: ManyContainerProp): void => {
    if (cp.append !== undefined) rule.add = cp.append;
    if (cp.remove !== undefined) rule.remove = cp.remove;
    if (cp.insert !== undefined) rule.insert = cp.insert;
    if (cp.reorder !== undefined) rule.reorder = cp.reorder;
    if (cp.autowrap !== undefined) rule.autowrap = cp.autowrap;
};

const applyOneToAttach = (rule: AttachRule, cp: OneContainerProp): void => {
    const setCall = setTargetCall(cp.set);
    if (setCall !== undefined) rule.add = setCall;
    if (cp.unset === undefined) return;
    const unsetCall = setTargetCall(cp.unset);
    if (unsetCall !== undefined) rule.remove = unsetCall;
};

/**
 * Converts a {@link ContainerProp} into the {@link AttachRule} that attaches a
 * child to `parent` through the prop's container methods.
 */
export const containerPropToAttach = (parent: string, cp: ContainerProp): AttachRule => {
    const rule: AttachRule = { kind: "attach", parent, child: cp.child };
    if (cp.prop !== "children") rule.slot = cp.prop;
    if (cp.arity === "many") applyManyToAttach(rule, cp);
    else applyOneToAttach(rule, cp);
    return rule;
};

/**
 * Converts a {@link ContainerProp} carrying an `adopt` into the corresponding
 * {@link CompanionRule}, or `undefined` when the prop has no `adopt`.
 */
export const containerPropToCompanion = (parent: string, cp: ContainerProp): CompanionRule | undefined => {
    const { adopt } = cp;
    if (adopt === undefined) return undefined;
    const rule: CompanionRule = { kind: "companion", element: adopt.element, parent };
    if (cp.arity === "many") {
        if (cp.append !== undefined) rule.add = cp.append;
        if (cp.insert !== undefined) rule.insert = cp.insert;
        if (cp.remove !== undefined) rule.remove = cp.remove;
    }
    if (adopt.accessor !== undefined) rule.companion = adopt.accessor;
    if (adopt.setters !== undefined) rule.setters = adopt.setters;
    return rule;
};
