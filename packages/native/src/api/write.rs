use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;

use crate::api::{handle_memory_range, native_result};
use crate::ffi::codec::{Codec, PtrWriter as _, SlotInit};
use crate::handle::Handle;

struct DisplacedField<'a> {
    fields: &'a crate::handle::FieldStore,
    offset: usize,
    transfer: Option<crate::ffi::PendingTransfer>,
}

impl DisplacedField<'_> {
    fn release(mut self) {
        drop(self.transfer.take());
    }
}

impl Drop for DisplacedField<'_> {
    fn drop(&mut self) {
        if let Some(transfer) = self.transfer.take() {
            self.fields.adopt(self.offset, transfer);
        }
    }
}

fn encode_field(
    env: &Env,
    field_ptr: *mut c_void,
    field_codec: &Codec,
    value: Unknown<'_>,
    init: SlotInit,
) -> anyhow::Result<Option<crate::ffi::PendingTransfer>> {
    field_codec.write_value_to_ptr(
        env,
        unsafe { crate::ffi::Slot::new(field_ptr) },
        value,
        init,
    )
}

pub(crate) fn write_field_at<'e>(
    env: &'e Env,
    handle: &Handle,
    field_codec: &Codec,
    offset: usize,
    value: Unknown<'_>,
) -> Result<Unknown<'e>> {
    let _leases = crate::handle::LeaseScope::open();
    let field_ptr = handle_memory_range(
        handle,
        offset,
        field_codec.field_size().unwrap_or(0),
        "field write",
    )?;
    let store = handle.field_store();
    let displaced = store.and_then(|(fields, base)| {
        let offset = base + offset;
        fields.take(offset).map(|transfer| DisplacedField {
            fields,
            offset,
            transfer: Some(transfer),
        })
    });
    let init = if displaced.is_some() {
        SlotInit::Uninitialized
    } else {
        SlotInit::Initialized
    };
    let transfer = native_result(
        "field write",
        encode_field(env, field_ptr, field_codec, value, init),
    )?;

    if let Some(displaced) = displaced {
        displaced.release();
    }

    if let Some(transfer) = transfer {
        match store {
            Some((fields, base)) => fields.adopt(base + offset, transfer),
            None => transfer.disarm(),
        }
    }

    ().into_unknown(env)
}
