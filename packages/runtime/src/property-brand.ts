const propertyMapOverride: unique symbol = Symbol("gtkx.propertyMapOverride");
const writablePropertyMapOverride: unique symbol = Symbol("gtkx.writablePropertyMapOverride");
const propertyWriteComplete: unique symbol = Symbol("gtkx.propertyWriteComplete");
const descriptorFreePropertySpec: unique symbol = Symbol("gtkx.descriptorFreePropertySpec");

type DescriptorFreePropertySpec<TSpec> = TSpec & { readonly [descriptorFreePropertySpec]: true };

export type { DescriptorFreePropertySpec };
export { descriptorFreePropertySpec, propertyMapOverride, propertyWriteComplete, writablePropertyMapOverride };
