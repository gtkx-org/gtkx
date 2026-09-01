use anyhow::bail;

use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{BoxedFreeFn, Handle};
use crate::host::error_reporter::ReportErr as _;

const LENT_ONLY: &str = "a plain struct declares no free function and has no known size, so nothing names the function that would release it: it can only be lent (transfer none), never handed over";

const CALL_LENT_ONLY: &str = "a plain struct lent for the duration of a call is read in place, so it cannot also be handed over";

const CALLER_ALLOCATED_LENT_ONLY: &str = "a caller-allocated plain struct is filled into storage this side already owns, so it cannot also be handed over";

const SLOT_LENT_ONLY: &str = "a plain struct written into a pointer slot is stored in place, and nothing would release what the slot held, so it cannot be handed over";

/// A struct's declared copy function, which duplicates an instance. A refcounted record spells the
/// same slot as its ref function, which returns the very pointer it was handed.
type StructCopyFn = unsafe extern "C" fn(*const c_void) -> *mut c_void;

#[derive(Debug, Clone)]
pub struct StructCodec {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub caller_allocated: bool,
    pub inline: bool,
    pub shared_library: Option<String>,
    pub copy_fn_name: Option<String>,
    pub free_fn_name: Option<String>,
}

impl Encoder for StructCodec {
    fn object_ptr_context(&self) -> &'static str {
        "Struct object"
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        ref_for_full_transfer(self.ownership, ptr, |ptr| self.duplicate(ptr))
    }
}

impl StructCodec {
    /// The declared copy and free functions, resolved together: a copy is only usable when
    /// something also names how to release what it returns.
    fn lifecycle_fns(&self) -> anyhow::Result<Option<(StructCopyFn, BoxedFreeFn)>> {
        let (Some(library), Some(copy_fn_name), Some(free_fn_name)) = (
            self.shared_library.as_deref(),
            self.copy_fn_name.as_deref(),
            self.free_fn_name.as_deref(),
        ) else {
            return Ok(None);
        };

        FfiCache::with(|state| unsafe {
            Ok(Some((
                state.resolve_symbol::<StructCopyFn>(library, copy_fn_name)?,
                state.resolve_symbol::<BoxedFreeFn>(library, free_fn_name)?,
            )))
        })
    }

    fn free_fn(&self) -> anyhow::Result<Option<BoxedFreeFn>> {
        let (Some(library), Some(free_fn_name)) =
            (self.shared_library.as_deref(), self.free_fn_name.as_deref())
        else {
            return Ok(None);
        };

        FfiCache::with(|state| unsafe {
            state.resolve_symbol::<BoxedFreeFn>(library, free_fn_name)
        })
        .map(Some)
    }

    /// Paths that store or read a pointer in place never release what was there before, so they
    /// take a struct only on loan however well its own lifecycle is described.
    fn ensure_lent(transfer: Ownership, context: &str) -> anyhow::Result<()> {
        anyhow::ensure!(transfer.is_borrowed(), "{context}");

        Ok(())
    }

    /// A full transfer is only accepted when the struct can be released: either it names its own
    /// free function, or its size makes it a `g_free`-able block this side can own outright.
    fn ensure_transfer(&self, transfer: Ownership) -> anyhow::Result<()> {
        anyhow::ensure!(
            transfer.is_borrowed() || self.names_free_fn() || self.size.is_some(),
            "{LENT_ONLY}"
        );

        Ok(())
    }

    /// Whether a free function can actually be resolved, which takes the library the symbol lives
    /// in as well as its name. A name on its own would fall back to `g_free` and free the struct
    /// through the wrong destructor.
    fn names_free_fn(&self) -> bool {
        self.shared_library.is_some() && self.free_fn_name.is_some()
    }

    /// Hands back a pointer this side no longer owns: the declared copy function when there is
    /// one, a byte copy when the size makes that sound, and an error when neither is available.
    fn duplicate(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if let Some((copy_fn, _)) = self.lifecycle_fns()? {
            return Ok(unsafe { copy_fn(ptr.cast_const()) });
        }

        match self.size {
            Some(size) => Ok(unsafe { glib::ffi::g_memdup2(ptr.cast_const(), size) }),
            None => bail!("{LENT_ONLY}"),
        }
    }

    /// Wraps a pointer the callee handed over, owning it through the declared free function when
    /// there is one and through `g_free` when only the size vouches for the allocation.
    fn take_ownership(&self, ptr: *mut c_void) -> anyhow::Result<Handle> {
        Ok(Handle::owned_struct_with_free_fn(ptr, self.free_fn()?))
    }

    /// Wraps a pointer the callee keeps owning: copied through the declared copy function, else
    /// through a byte copy when the size makes one sound, else borrowed for the call's duration.
    fn borrow_or_copy(&self, ptr: *mut c_void) -> anyhow::Result<Handle> {
        if let Some((copy_fn, free_fn)) = self.lifecycle_fns()? {
            return Ok(Handle::owned_struct_with_free_fn(
                unsafe { copy_fn(ptr.cast_const()) },
                Some(free_fn),
            ));
        }

        Ok(self.size.map_or_else(
            || Handle::from_glib_borrow(ptr),
            |size| Handle::owned_struct(unsafe { glib::ffi::g_memdup2(ptr.cast_const(), size) }),
        ))
    }

    fn acquire(&self, ptr: *mut c_void, transfer: Ownership) -> anyhow::Result<Handle> {
        self.ensure_transfer(transfer)?;

        if transfer.is_full() {
            return self.take_ownership(ptr);
        }

        self.borrow_or_copy(ptr)
    }

    fn write_inline(
        &self,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let Some(size) = self.size else {
            bail!("Cannot write an inline struct field whose size is unknown")
        };
        let src_ptr = value::handle_ptr(value, "Struct field write")?;
        if src_ptr.is_null() {
            bail!("Cannot write null into an inline struct field")
        }
        if is_slot_its_own_source(slot, src_ptr) {
            return Ok(None);
        }
        copy_into_slot(slot, src_ptr, size);
        Ok(None)
    }

    fn write_pointer_slot(
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
        size: usize,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let src_ptr = value::handle_ptr(value, "Struct field write")?;
        if src_ptr.is_null() {
            unsafe { slot.store(std::ptr::null_mut()) };
            return Ok(None);
        }
        if !init.is_initialized() {
            unsafe { slot.store(src_ptr) };
            return Ok(None);
        }
        let dest_ptr = unsafe { slot.load() };
        if dest_ptr.is_null() {
            bail!("Struct field write into null pointer slot")
        }
        unsafe {
            std::ptr::copy_nonoverlapping(src_ptr.cast::<u8>(), dest_ptr.cast::<u8>(), size);
        }
        Ok(None)
    }
}

impl Decoder for StructCodec {
    fn is_inline(&self) -> bool {
        self.inline
    }

    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Struct", |struct_ptr| {
            Ok(value::handle_to_unknown(
                env,
                self.acquire(struct_ptr, self.ownership)?,
            )?)
        })
    }

    read_value_non_null!(|self, env, ptr, transfer| {
        let handle = if self.caller_allocated {
            Self::ensure_lent(transfer, CALLER_ALLOCATED_LENT_ONLY)?;

            Handle::from_glib_borrow(ptr)
        } else {
            self.acquire(ptr, transfer)?
        };

        Ok(value::handle_to_unknown(env, handle)?)
    });

    unsafe fn read_lent_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        Self::ensure_lent(transfer, CALL_LENT_ONLY)?;

        self.decode_non_null(env, ptr, |ptr| {
            Ok(value::handle_to_unknown(
                env,
                Handle::from_glib_borrow(ptr),
            )?)
        })
    }
}

impl PtrWriter for StructCodec {
    fn write_return_to_ptr(
        &self,
        _env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        write_return_object_ptr(ret, value, |ptr| {
            unsafe { self.ref_for_transfer(ptr) }
                .report_err("Struct return")
                .unwrap_or(std::ptr::null_mut())
        });
    }

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        if self.inline {
            return self.write_inline(slot, value);
        }

        Self::ensure_lent(self.ownership, SLOT_LENT_ONLY)?;

        match self.size {
            Some(size) => Self::write_pointer_slot(slot, value, init, size),
            None => write_object_ptr(slot, value, "Struct field write", |handle| {
                Encoder::check_instance(self, handle)
            }),
        }
    }
}
