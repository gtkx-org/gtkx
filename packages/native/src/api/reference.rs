use napi::Env;
use napi::bindgen_prelude::*;

use crate::ffi::codec::{Codec, RefCodec};
use crate::ffi::{Stash, StashStorage};
use crate::handle::Handle;

pub(crate) struct ReferenceRequest<'codec, 'env> {
    codec: &'codec RefCodec,
    seed: Unknown<'env>,
    owners: Vec<Handle>,
}

impl<'codec, 'env> ReferenceRequest<'codec, 'env> {
    pub(crate) fn capture(codec: &'codec RefCodec, value: Unknown<'env>) -> anyhow::Result<Self> {
        let cell: Object<'_> = crate::value::read_napi(value)?;
        let seed: Unknown<'env> = cell.get_named_property("value")?;
        let mut owners = Vec::new();
        if codec.is_caller_allocated_buffer() {
            let handle: &External<Handle> = crate::value::read_napi(seed)?;
            owners.push((**handle).clone());
        } else {
            collect_seed_owners(codec.inner_codec(), seed, &mut owners, true)?;
        }
        let owners = owners
            .into_iter()
            .map(|owner| owner.retain_owned().unwrap_or(owner))
            .collect();
        Ok(Self {
            codec,
            seed,
            owners,
        })
    }

    pub(crate) fn prepare(&self, env: &Env, independent: bool) -> anyhow::Result<Stash> {
        let mut owners = Vec::new();
        if !self.codec.is_caller_allocated_buffer() {
            collect_seed_owners(self.codec.inner_codec(), self.seed, &mut owners, false)?;
        }
        let encoded = self.codec.prepare_storage(env, self.seed, independent)?;
        let mut prepared = match encoded {
            Stash::Storage(storage) => storage,
            Stash::Ptr(ptr) => StashStorage::unit(ptr),
            _ => anyhow::bail!("Reference storage did not produce pointer-shaped storage"),
        };
        for owner in owners {
            prepared = prepared.with_reference_owner(&owner, independent)?;
        }
        if !independent {
            for owner in &self.owners {
                prepared = prepared.with_reference_owner(owner, false)?;
            }
        }
        Ok(Stash::Storage(prepared))
    }
}

pub(crate) fn collect_seed_owners(
    codec: &Codec,
    seed: Unknown<'_>,
    owners: &mut Vec<Handle>,
    include_transferred: bool,
) -> anyhow::Result<()> {
    if matches!(seed.get_type()?, ValueType::Null | ValueType::Undefined) {
        return Ok(());
    }
    if codec.is_handle_backed() {
        let handle: &External<Handle> = crate::value::read_napi(seed)?;
        if include_transferred || codec.transfer().is_borrowed() {
            owners.push((**handle).clone());
        }
        return Ok(());
    }
    match codec {
        Codec::Array(array) if seed.is_array()? => {
            let values: Array<'_> = crate::value::read_napi(seed)?;
            for index in 0..values.len() {
                if let Some(value) = values.get(index)? {
                    collect_seed_owners(&array.item_codec, value, owners, include_transferred)?;
                }
            }
        }
        Codec::HashTable(table) => {
            let values: Array<'_> = crate::value::read_napi(seed)?;
            for index in 0..values.len() {
                if let Some(entry) = values.get::<Array<'_>>(index)? {
                    if let Some(key) = entry.get(0)? {
                        collect_seed_owners(&table.key_codec, key, owners, include_transferred)?;
                    }
                    if let Some(value) = entry.get(1)? {
                        collect_seed_owners(
                            &table.value_codec,
                            value,
                            owners,
                            include_transferred,
                        )?;
                    }
                }
            }
        }
        _ => {}
    }
    Ok(())
}
