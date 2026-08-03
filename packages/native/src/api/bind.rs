use std::cell::OnceCell;
use std::ffi::c_void;

use libffi::middle::{Builder, Cif, CodePtr};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::vtable::{query_type, resolve_vfunc_slot, validate_vfunc_offset};
use crate::api::{native_result, type_from_bigint};
use crate::ffi::codec::{Codec, Encoder as _};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::library_cache::FfiCache;

pub(crate) enum CallTarget {
    Symbol {
        library_name: String,
        symbol_name: String,
    },
    Vfunc {
        instance_type: glib::Type,
        interface_type: Option<glib::Type>,
        byte_offset: usize,
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
    /// `GType` whose class structure the slot is read from.
    pub instance_type: BigInt,
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
            CallTarget::Symbol {
                library_name,
                symbol_name,
            } => FfiCache::with(|state| {
                let symbol = unsafe {
                    state.resolve_symbol::<unsafe extern "C" fn() -> ()>(library_name, symbol_name)
                }?;
                anyhow::Ok(CodePtr(symbol as *mut c_void))
            })?,
            CallTarget::Vfunc {
                instance_type,
                interface_type,
                byte_offset,
            } => CodePtr(resolve_vfunc_slot(
                *instance_type,
                *interface_type,
                *byte_offset,
                &self.label,
            )?),
        };
        let _ = self.symbol.set(resolved);

        Ok(resolved)
    }
}

pub(crate) fn prepare(
    target: CallTarget,
    label: String,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
) -> CallDescriptor {
    let mut arg_types = Vec::with_capacity(arg_codecs.len());
    for codec in &arg_codecs {
        codec.append_ffi_arg_types(&mut arg_types);
    }
    let native_arg_count = arg_types.len();
    let cif = Builder::new()
        .res(return_codec.libffi_type())
        .args(arg_types)
        .into_cif();

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

fn vfunc_offset_bounds(
    instance_type: glib::Type,
    interface_type: Option<glib::Type>,
    vtable_size: Option<u32>,
    label: &str,
) -> anyhow::Result<Option<u32>> {
    let Some(interface_type) = interface_type else {
        return Ok(query_type(instance_type).map(|query| query.class_size));
    };

    if vtable_size.is_none() {
        anyhow::bail!(
            "{label} binds a slot of interface {interface_type} without a vtable size, which \
             would leave byte_offset bounded only by its alignment"
        );
    }

    Ok(vtable_size)
}

/// Precompiles the argument and return marshalling of `symbolName` in `sharedLibrary` into a
/// reusable call descriptor that `call` can invoke. The symbol itself is resolved on the first
/// call, so binding a symbol the installed library does not export fails only when it is called.
#[napi(catch_unwind)]
pub fn bind(
    shared_library: String,
    symbol_name: String,
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
) -> Result<External<CallDescriptor>> {
    let (arg_codecs, return_codec) = into_codecs(arg_descriptors, return_descriptor)?;
    let label = symbol_name.clone();

    Ok(External::new(prepare(
        CallTarget::Symbol {
            library_name: shared_library,
            symbol_name,
        },
        label,
        arg_codecs,
        return_codec,
    )))
}

/// Precompiles a call to the virtual function slot at `byteOffset` of `instanceType`'s class
/// structure, or of the `interfaceType` vtable that class carries, into a reusable call descriptor
/// that `call` can invoke. The slot's function pointer is read on the first call, so a slot the
/// type leaves empty fails only when it is called.
#[napi(catch_unwind)]
pub fn bind_vfunc(options: BindVfuncOptions) -> Result<External<CallDescriptor>> {
    let instance_type = type_from_bigint(&options.instance_type, "bind_vfunc: instance")?;
    let interface_type = options
        .interface_type
        .as_ref()
        .map(|type_| type_from_bigint(type_, "bind_vfunc: interface"))
        .transpose()?;
    let byte_offset = options.byte_offset as usize;

    let bounds = native_result(
        "bind_vfunc",
        vfunc_offset_bounds(
            instance_type,
            interface_type,
            options.vtable_size,
            &options.label,
        ),
    )?;

    native_result(
        "bind_vfunc",
        validate_vfunc_offset(byte_offset, bounds, &options.label),
    )?;

    let (arg_codecs, return_codec) =
        into_codecs(options.arg_descriptors, options.return_descriptor)?;

    Ok(External::new(prepare(
        CallTarget::Vfunc {
            instance_type,
            interface_type,
            byte_offset,
        },
        options.label,
        arg_codecs,
        return_codec,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::IntegerCodec;

    fn symbol_target(symbol_name: &str) -> CallTarget {
        CallTarget::Symbol {
            library_name: "libgtk-4.so.1".to_owned(),
            symbol_name: symbol_name.to_owned(),
        }
    }

    #[test]
    fn builds_the_call_interface_without_resolving_the_symbol() {
        test_support::run(|| {
            let descriptor = prepare(
                symbol_target("gtkx_no_such_symbol"),
                "gtkx_no_such_symbol".to_owned(),
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
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
                    instance_type: glib::Object::static_type(),
                    interface_type: None,
                    byte_offset: std::mem::offset_of!(glib::gobject_ffi::GObjectClass, finalize),
                },
                "ObjectClass.finalize".to_owned(),
                Vec::new(),
                Codec::Void(crate::ffi::codec::VoidCodec),
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
                symbol_target("gtk_get_major_version"),
                "gtk_get_major_version".to_owned(),
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
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
