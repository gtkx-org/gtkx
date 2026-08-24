use std::cell::OnceCell;
use std::ffi::c_void;

use libffi::middle::{Builder, Cif, CodePtr, Type};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::vtable::{VfuncVtable, query_type, resolve_vfunc_slot, validate_vfunc_offset};
use crate::api::{native_result, type_from_bigint};
use crate::ffi::codec::{Codec, Encoder as _, LeaseAction, ResourceAction};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::library_cache::FfiCache;

pub(crate) enum CallTarget {
    Symbol {
        library_name: String,
    },
    Vfunc {
        vtable: VfuncVtable,
        byte_offset: usize,
    },
    Pointer {
        address: usize,
    },
}

pub struct CallDescriptor {
    pub(crate) target: CallTarget,
    pub(crate) label: String,
    pub(crate) arg_codecs: Vec<Codec>,
    pub(crate) return_codec: Codec,
    pub(crate) cif: Cif,
    pub(crate) symbol: OnceCell<CodePtr>,
    pub(crate) native_arg_count: usize,
}

/// A vtable slot to precompile a call to, together with how its arguments and return value are
/// marshalled. Chain-up binds the slot against the parent type, so the call reaches the
/// implementation the parent provides rather than the override installed on the subclass.
#[napi(object, object_to_js = false)]
pub struct BindVfuncOptions {
    /// `GType` whose class structure the slot is read from. Omitted to read the slot out of
    /// `interfaceType`'s own default vtable instead, which holds what the interface installs by
    /// default and is exactly what a class adopting the interface without filling the slot carries.
    pub instance_type: Option<BigInt>,
    /// `GType` of the interface owning the slot, omitted when the slot lives in the class struct.
    pub interface_type: Option<BigInt>,
    /// Byte offset of the slot within the class (or interface) struct.
    pub byte_offset: u32,
    /// Byte size of the interface's vtable struct, used to bounds-check `byteOffset`. `g_type_query`
    /// reports nothing for an interface type, so the size has to come from the same generated
    /// metadata the offsets do, and binding an interface slot without it is rejected. A class slot
    /// is bounded by the queried class size instead and does not need it.
    pub vtable_size: Option<u32>,
    /// Name the slot is reported under in error messages, such as `WidgetClass.measure`.
    pub label: String,
    /// Descriptor for each argument the slot receives, starting with the instance.
    pub arg_descriptors: Vec<Descriptor>,
    /// Descriptor for the value the slot returns.
    pub return_descriptor: Descriptor,
}

impl CallDescriptor {
    pub(crate) fn symbol(&self) -> anyhow::Result<CodePtr> {
        if let Some(symbol) = self.symbol.get() {
            return Ok(*symbol);
        }

        let resolved = match &self.target {
            CallTarget::Symbol { library_name } => FfiCache::with(|state| {
                let symbol = unsafe {
                    state.resolve_symbol::<unsafe extern "C" fn() -> ()>(library_name, &self.label)
                }?;
                anyhow::Ok(CodePtr(symbol as *mut c_void))
            })?,
            CallTarget::Vfunc {
                vtable,
                byte_offset,
            } => CodePtr(resolve_vfunc_slot(*vtable, *byte_offset, &self.label)?),
            CallTarget::Pointer { address } => CodePtr(*address as *mut c_void),
        };
        let _ = self.symbol.set(resolved);

        Ok(resolved)
    }
}

fn build_arg_types(
    arg_codecs: &[Codec],
    fixed_arg_count: Option<usize>,
) -> (Vec<Type>, Option<usize>) {
    let mut arg_types = Vec::with_capacity(arg_codecs.len());
    let mut fixed_type_count = None;

    for (index, codec) in arg_codecs.iter().enumerate() {
        if fixed_arg_count == Some(index) {
            fixed_type_count = Some(arg_types.len());
        }

        codec.append_ffi_arg_types(&mut arg_types);
    }

    if fixed_arg_count == Some(arg_codecs.len()) {
        fixed_type_count = Some(arg_types.len());
    }

    (arg_types, fixed_type_count)
}

pub(crate) fn prepare(
    target: CallTarget,
    label: String,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
    fixed_arg_count: Option<usize>,
) -> CallDescriptor {
    let (arg_types, fixed_type_count) = build_arg_types(&arg_codecs, fixed_arg_count);
    let native_arg_count = arg_types.len();
    let return_type = return_codec.libffi_type();
    let cif = match fixed_type_count {
        Some(fixed) => Cif::new_variadic(arg_types, fixed, return_type),
        None => Builder::new().res(return_type).args(arg_types).into_cif(),
    };

    CallDescriptor {
        target,
        label,
        arg_codecs,
        return_codec,
        cif,
        symbol: OnceCell::new(),
        native_arg_count,
    }
}

fn into_codecs(
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
) -> Result<(Vec<Codec>, Codec)> {
    let arg_codecs = arg_descriptors
        .into_iter()
        .map(Descriptor::into_codec)
        .collect::<Result<Vec<_>>>()?;

    Ok((arg_codecs, return_descriptor.into_codec()?))
}

fn is_borrowed_boxed(codec: &Codec) -> bool {
    matches!(codec, Codec::Boxed(_)) && codec.transfer().is_borrowed()
}

fn is_full_boxed(codec: &Codec) -> bool {
    matches!(codec, Codec::Boxed(_)) && codec.transfer().is_full()
}

fn validate_leases(
    arg_codecs: &[Codec],
    return_codec: &Codec,
    release_target: Option<(&str, &str)>,
    is_variadic: bool,
) -> anyhow::Result<()> {
    for (index, codec) in arg_codecs.iter().enumerate() {
        anyhow::ensure!(
            matches!(codec, Codec::Lease(_)) || !codec.contains_lease(),
            "arg {index} nests a lease descriptor; leases are only valid as top-level call descriptors"
        );
        let Codec::Lease(lease) = codec else {
            continue;
        };
        match lease.action() {
            LeaseAction::Result | LeaseAction::Alias => anyhow::bail!(
                "arg {index} uses a lease return descriptor, which is only valid as a return"
            ),
            LeaseAction::Guard | LeaseAction::Access => {}
            LeaseAction::End => {
                let owner_index = lease
                    .owner_param_index()
                    .ok_or_else(|| anyhow::anyhow!("lease end arg {index} has no owner"))?;
                anyhow::ensure!(
                    owner_index != index,
                    "lease end arg {index} cannot be its own owner"
                );
                anyhow::ensure!(
                    arg_codecs.len() == 2
                        && owner_index == 0
                        && index == 1
                        && !is_variadic
                        && matches!(return_codec, Codec::Void(_)),
                    "a lease release binding must have exactly (owner, leased value) arguments and return void"
                );
                let owner = arg_codecs.get(owner_index).ok_or_else(|| {
                    anyhow::anyhow!("lease end arg {index} owner {owner_index} is out of range")
                })?;
                anyhow::ensure!(
                    is_borrowed_boxed(owner),
                    "lease end arg {index} owner {owner_index} is not a borrowed boxed descriptor"
                );
                let Some((library, symbol)) = release_target else {
                    anyhow::bail!("lease end arg {index} can only bind its named release symbol")
                };
                anyhow::ensure!(
                    library == lease.kind().shared_library()
                        && symbol == lease.kind().release_fn_name(),
                    "lease end arg {index} belongs to a different release symbol"
                );
            }
        }
    }

    anyhow::ensure!(
        matches!(return_codec, Codec::Lease(_)) || !return_codec.contains_lease(),
        "the return descriptor nests a lease; leases are only valid as top-level call descriptors"
    );

    if let Codec::Lease(lease) = return_codec {
        match lease.action() {
            LeaseAction::Result => {
                let owner_index = lease
                    .owner_param_index()
                    .ok_or_else(|| anyhow::anyhow!("a lease result has no owner"))?;
                let Some(Codec::Lease(owner)) = arg_codecs.get(owner_index) else {
                    anyhow::bail!(
                        "lease result owner {owner_index} is not guarded by its lease kind"
                    )
                };
                anyhow::ensure!(
                    owner.action() == LeaseAction::Guard && owner.kind() == lease.kind(),
                    "lease result owner {owner_index} is guarded by a different lease kind"
                );
            }
            LeaseAction::Alias => {
                anyhow::ensure!(!is_variadic, "a lease alias return cannot be variadic");
                anyhow::ensure!(
                    is_full_boxed(lease.inner_codec()),
                    "a lease alias return must wrap a full boxed descriptor"
                );
                let owner_index = lease
                    .owner_param_index()
                    .ok_or_else(|| anyhow::anyhow!("a lease alias has no owner"))?;
                let Some(Codec::Lease(owner)) = arg_codecs.get(owner_index) else {
                    anyhow::bail!(
                        "lease alias owner {owner_index} is not accessed by its lease kind"
                    )
                };
                anyhow::ensure!(
                    owner.action() == LeaseAction::Access
                        && owner.kind() == lease.kind()
                        && is_borrowed_boxed(owner.inner_codec()),
                    "lease alias owner {owner_index} is accessed by a different lease kind or type"
                );
            }
            LeaseAction::End | LeaseAction::Guard | LeaseAction::Access => {
                anyhow::bail!("a lease input descriptor cannot be used as a return")
            }
        }
    }

    Ok(())
}

fn validate_resources(
    arg_codecs: &[Codec],
    return_codec: &Codec,
    release_target: Option<(&str, &str)>,
    is_variadic: bool,
) -> anyhow::Result<()> {
    let mut has_result = false;

    for (index, codec) in arg_codecs.iter().enumerate() {
        match codec {
            Codec::Resource(resource) => {
                anyhow::ensure!(
                    resource.action() == ResourceAction::End,
                    "arg {index} uses a resource result descriptor outside a Ref"
                );
                anyhow::ensure!(
                    arg_codecs.len() == 1 && !is_variadic && matches!(return_codec, Codec::Void(_)),
                    "a resource release binding must have exactly one argument and return void"
                );
                let Some((library, symbol)) = release_target else {
                    anyhow::bail!("resource end arg {index} can only bind its named release symbol")
                };
                anyhow::ensure!(
                    library == resource.kind().shared_library()
                        && symbol == resource.kind().release_fn_name(),
                    "resource end arg {index} belongs to a different release symbol"
                );
            }
            Codec::Ref(reference) => {
                let Codec::Resource(resource) = reference.inner_codec() else {
                    anyhow::ensure!(
                        !reference.inner_codec().contains_resource(),
                        "arg {index} nests a resource descriptor; a result resource is only valid directly inside a Ref"
                    );
                    continue;
                };
                anyhow::ensure!(
                    resource.action() == ResourceAction::Result && !reference.is_inout(),
                    "arg {index} must be a non-inout Ref of a resource result"
                );
                has_result = true;
            }
            _ => anyhow::ensure!(
                !codec.contains_resource(),
                "arg {index} nests a resource descriptor; resources are only valid as top-level ends or direct Ref results"
            ),
        }
    }

    anyhow::ensure!(
        !return_codec.contains_resource(),
        "the return descriptor cannot use a resource descriptor"
    );
    anyhow::ensure!(
        !has_result
            || !arg_codecs.iter().any(
                |codec| matches!(codec, Codec::Callback(callback) if callback.is_async_completion()),
            ),
        "a resource result cannot be combined with an async completion callback"
    );

    Ok(())
}

fn validate_ownership_descriptors(
    arg_codecs: &[Codec],
    return_codec: &Codec,
    release_target: Option<(&str, &str)>,
    is_variadic: bool,
) -> anyhow::Result<()> {
    validate_leases(arg_codecs, return_codec, release_target, is_variadic)?;
    validate_resources(arg_codecs, return_codec, release_target, is_variadic)
}

fn vfunc_vtable(
    instance_type: Option<glib::Type>,
    interface_type: Option<glib::Type>,
    label: &str,
) -> anyhow::Result<VfuncVtable> {
    match (instance_type, interface_type) {
        (Some(instance_type), Some(interface_type)) => Ok(VfuncVtable::Interface {
            instance_type,
            interface_type,
        }),
        (Some(instance_type), None) => Ok(VfuncVtable::Class(instance_type)),
        (None, Some(interface_type)) => Ok(VfuncVtable::DefaultInterface(interface_type)),
        (None, None) => anyhow::bail!(
            "{label} binds a slot with neither an instance type nor an interface type to read it \
             from"
        ),
    }
}

fn vfunc_offset_bounds(
    vtable: VfuncVtable,
    vtable_size: Option<u32>,
    label: &str,
) -> anyhow::Result<u32> {
    match vtable {
        VfuncVtable::Class(instance_type) => query_type(instance_type)
            .map(|query| query.class_size)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "{label} binds a class slot of type '{}', whose class size g_type_query does \
                     not report",
                    instance_type.name()
                )
            }),
        VfuncVtable::Interface { interface_type, .. }
        | VfuncVtable::DefaultInterface(interface_type) => vtable_size.ok_or_else(|| {
            anyhow::anyhow!(
                "{label} binds a slot of interface {interface_type} without a vtable size, which \
                 would leave byte_offset bounded only by its alignment"
            )
        }),
    }
}

/// Precompiles the argument and return marshalling of `symbolName` in `sharedLibrary` into a
/// reusable call descriptor that `call` can invoke. The symbol itself is resolved on the first
/// call, so binding a symbol the installed library does not export fails only when it is called.
///
/// `fixedArgCount` marks the callee as variadic, naming how many of `argDescriptors` precede the
/// ellipsis. Omitting it binds a plain fixed-arity call.
#[napi(catch_unwind)]
pub fn bind(
    shared_library: String,
    symbol_name: String,
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
    fixed_arg_count: Option<u32>,
) -> Result<External<CallDescriptor>> {
    let (arg_codecs, return_codec) = into_codecs(arg_descriptors, return_descriptor)?;
    native_result(
        "binding ownership descriptors",
        validate_ownership_descriptors(
            &arg_codecs,
            &return_codec,
            Some((&shared_library, &symbol_name)),
            fixed_arg_count.is_some(),
        ),
    )?;

    Ok(External::new(prepare(
        CallTarget::Symbol {
            library_name: shared_library,
        },
        symbol_name,
        arg_codecs,
        return_codec,
        fixed_arg_count.map(|count| count as usize),
    )))
}

/// Precompiles the argument and return marshalling of a call to a raw C function pointer into a
/// reusable call descriptor that `call` can invoke. The pointer comes from a native caller that
/// handed a callback into a JavaScript-implemented virtual function or callback, decoded as a
/// bigint address; it must stay valid for as long as the descriptor is called through.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn bind_function_pointer(
    fn_ptr: BigInt,
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
    label: String,
) -> Result<External<CallDescriptor>> {
    let (_, raw_address, lossless) = fn_ptr.get_u64();
    let address = usize::try_from(raw_address).unwrap_or(0);

    if !lossless || address == 0 {
        return Err(Error::new(
            Status::InvalidArg,
            format!("{label}: a function pointer must be a non-zero address-sized value"),
        ));
    }

    let (arg_codecs, return_codec) = into_codecs(arg_descriptors, return_descriptor)?;
    native_result(
        "binding ownership descriptors",
        validate_ownership_descriptors(&arg_codecs, &return_codec, None, false),
    )?;

    Ok(External::new(prepare(
        CallTarget::Pointer { address },
        label,
        arg_codecs,
        return_codec,
        None,
    )))
}

/// Precompiles a call to the virtual function slot at `byteOffset` of `instanceType`'s class
/// structure, of the `interfaceType` vtable that class carries, or of `interfaceType`'s own default
/// vtable when no `instanceType` is given, into a reusable call descriptor that `call` can invoke.
/// The slot's function pointer is read on the first call, so a slot the type leaves empty fails
/// only when it is called.
#[napi(catch_unwind)]
pub fn bind_vfunc(options: BindVfuncOptions) -> Result<External<CallDescriptor>> {
    let instance_type = options
        .instance_type
        .as_ref()
        .map(|type_| type_from_bigint(type_, "bind_vfunc: instance"))
        .transpose()?;
    let interface_type = options
        .interface_type
        .as_ref()
        .map(|type_| type_from_bigint(type_, "bind_vfunc: interface"))
        .transpose()?;
    let byte_offset = options.byte_offset as usize;

    let vtable = native_result(
        "bind_vfunc",
        vfunc_vtable(instance_type, interface_type, &options.label),
    )?;

    let bounds = native_result(
        "bind_vfunc",
        vfunc_offset_bounds(vtable, options.vtable_size, &options.label),
    )?;

    native_result(
        "bind_vfunc",
        validate_vfunc_offset(byte_offset, bounds, &options.label),
    )?;

    let (arg_codecs, return_codec) =
        into_codecs(options.arg_descriptors, options.return_descriptor)?;
    native_result(
        "binding ownership descriptors",
        validate_ownership_descriptors(&arg_codecs, &return_codec, None, false),
    )?;

    Ok(External::new(prepare(
        CallTarget::Vfunc {
            vtable,
            byte_offset,
        },
        options.label,
        arg_codecs,
        return_codec,
        None,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::IntegerCodec;

    fn symbol_target() -> CallTarget {
        CallTarget::Symbol {
            library_name: "libgtk-4.so.1".to_owned(),
        }
    }

    #[test]
    fn counts_fixed_arguments_in_expanded_ffi_types() {
        let codecs = vec![
            Codec::Integer(IntegerCodec::U32),
            Codec::Integer(IntegerCodec::U32),
            Codec::Integer(IntegerCodec::U32),
        ];

        assert_eq!(build_arg_types(&codecs, None).1, None);
        assert_eq!(build_arg_types(&codecs, Some(0)).1, Some(0));
        assert_eq!(build_arg_types(&codecs, Some(2)).1, Some(2));
        assert_eq!(build_arg_types(&codecs, Some(codecs.len())).1, Some(3));
    }

    #[test]
    fn builds_a_variadic_call_interface() {
        test_support::run(|| {
            let descriptor = prepare(
                symbol_target(),
                "gtk_test_accessible_check_state".to_owned(),
                vec![
                    Codec::Integer(IntegerCodec::U32),
                    Codec::Integer(IntegerCodec::U32),
                    Codec::Integer(IntegerCodec::I32),
                ],
                Codec::Integer(IntegerCodec::U32),
                Some(2),
            );

            assert_eq!(descriptor.native_arg_count, 3);
            assert!(descriptor.symbol().is_ok());
        });
    }

    #[test]
    fn builds_the_call_interface_without_resolving_the_symbol() {
        test_support::run(|| {
            let descriptor = prepare(
                symbol_target(),
                "gtkx_no_such_symbol".to_owned(),
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
                None,
            );

            assert_eq!(descriptor.native_arg_count, 0);
            assert!(descriptor.symbol.get().is_none());
            assert!(descriptor.symbol().is_err());
        });
    }

    #[test]
    fn memoizes_the_resolved_vfunc_slot() {
        test_support::run(|| {
            use glib::prelude::StaticType as _;

            let descriptor = prepare(
                CallTarget::Vfunc {
                    vtable: VfuncVtable::Class(glib::Object::static_type()),
                    byte_offset: std::mem::offset_of!(glib::gobject_ffi::GObjectClass, finalize),
                },
                "ObjectClass.finalize".to_owned(),
                Vec::new(),
                Codec::Void(crate::ffi::codec::VoidCodec),
                None,
            );

            assert!(descriptor.symbol.get().is_none());
            let first = descriptor.symbol().expect("the slot resolves");
            assert!(!first.as_mut_ptr().is_null());
            assert_eq!(
                descriptor.symbol.get().map(|symbol| symbol.as_mut_ptr()),
                Some(first.as_mut_ptr())
            );
        });
    }

    #[test]
    fn memoizes_the_resolved_symbol() {
        test_support::run(|| {
            let descriptor = prepare(
                symbol_target(),
                "gtk_get_major_version".to_owned(),
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
                None,
            );

            let first = descriptor.symbol().expect("the symbol resolves");
            assert!(!first.as_mut_ptr().is_null());
            assert_eq!(
                descriptor.symbol.get().map(|symbol| symbol.as_mut_ptr()),
                Some(first.as_mut_ptr())
            );
        });
    }
}
