use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::{Rc, Weak};

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::bind::CallSignature;
use crate::api::native_result;
use crate::ffi::Stash;
use crate::ffi::codec::{Codec, RefCodec};
use crate::host::callback_error::CallbackErrorScope;
use crate::value::ClosureHandle;

#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReferenceMode {
    Slot,
    Inout,
    FixedBytes,
    CallerArray,
    CallerContainer,
    ArrayBuffer,
    ArraySlot,
}

thread_local! {
    static REFERENCE_SEEDS: RefCell<HashMap<usize, Vec<Weak<ReferenceSeed>>>> = RefCell::new(HashMap::new());
}

#[derive(Debug)]
pub(crate) struct ReferenceSeed {
    value: RefCell<Option<ClosureHandle>>,
}

impl ReferenceSeed {
    fn new(env: &Env, seed: Unknown<'_>) -> Result<Rc<Self>> {
        let mut array = env.create_array(1)?;
        array.set(0, seed)?;
        let seed = Rc::new(Self {
            value: RefCell::new(Some(ClosureHandle::from_js_value(env, &array)?)),
        });
        let key = env.raw() as usize;
        REFERENCE_SEEDS.with_borrow_mut(|environments| {
            if let std::collections::hash_map::Entry::Vacant(entry) = environments.entry(key) {
                env.add_env_cleanup_hook(key, |key| {
                    let seeds = REFERENCE_SEEDS.with_borrow_mut(|entries| entries.remove(&key));
                    for seed in seeds
                        .into_iter()
                        .flatten()
                        .filter_map(|weak| weak.upgrade())
                    {
                        seed.value.borrow_mut().take();
                    }
                })?;
                entry.insert(Vec::new());
            }
            if let Some(seeds) = environments.get_mut(&key) {
                if seeds.len() % 64 == 0 {
                    seeds.retain(|weak| weak.strong_count() > 0);
                }
                seeds.push(Rc::downgrade(&seed));
            }
            Ok::<_, Error>(())
        })?;
        Ok(seed)
    }

    fn read<'e>(&self, env: &'e Env) -> Result<Unknown<'e>> {
        let held = self.value.borrow();
        let held = held
            .as_ref()
            .ok_or_else(|| Error::from_reason("The reference seed environment has ended"))?;
        let array: Array<'_> = held.get(env)?;
        array
            .get::<Unknown<'_>>(0)?
            .ok_or_else(|| Error::from_reason("Reference storage contains no value"))
    }
}

#[derive(Debug)]
struct ReferenceRequest {
    codec: RefCodec,
    seed: Rc<ReferenceSeed>,
    mode: ReferenceMode,
    capacity: Option<usize>,
    owners: Vec<crate::handle::Handle>,
}

#[derive(Debug)]
pub struct ReferenceStorage {
    identity: Rc<()>,
    request: RefCell<Option<ReferenceRequest>>,
}

impl ReferenceStorage {
    pub(crate) fn take(
        &self,
        env: &Env,
        identity: &Rc<()>,
        independent: bool,
    ) -> anyhow::Result<Stash> {
        anyhow::ensure!(
            Rc::ptr_eq(&self.identity, identity),
            "Reference storage belongs to another descriptor"
        );
        let request = self
            .request
            .borrow_mut()
            .take()
            .ok_or_else(|| anyhow::anyhow!("Reference storage has already been consumed"))?;
        let seed = request.seed.read(env)?;
        let mut owners = Vec::new();
        collect_seed_owners(request.codec.inner_codec(), seed, &mut owners, false)?;
        let encoded = request.codec.prepare_storage(
            env,
            seed,
            request.mode,
            request.capacity,
            independent,
        )?;
        let mut prepared = match encoded {
            Stash::Storage(storage) => storage,
            Stash::Ptr(ptr) => crate::ffi::StashStorage::unit(ptr),
            _ => anyhow::bail!("Reference storage did not produce pointer-shaped storage"),
        };
        for owner in owners {
            prepared = prepared.with_reference_owner(&owner, independent)?;
        }
        for owner in &request.owners {
            if !independent {
                prepared = prepared.with_reference_owner(owner, false)?;
            }
        }
        if !independent {
            prepared = prepared.with_reference_seed(request.seed);
        }
        Ok(Stash::Storage(prepared))
    }
}

/// Owns a normalized reference seed for an argument in a compiled call signature. The argument
/// index precedes ABI expansion and reordering. The matching call prepares storage within its
/// lease scope, preserving synchronous buffer views and owning asynchronous buffers.
#[napi(catch_unwind)]
pub fn create_reference_storage(
    env: Env,
    signature: &External<CallSignature>,
    arg_index: u32,
    seed: Unknown<'_>,
    mode: ReferenceMode,
    capacity: Option<BigInt>,
) -> Result<External<ReferenceStorage>> {
    let _errors = CallbackErrorScope::open(env);
    let _leases = crate::handle::LeaseScope::open();
    let codec = match signature.arg_codecs.get(arg_index as usize) {
        Some(Codec::Ref(codec)) if !codec.inner_codec().is_scalar() => codec,
        Some(_) => {
            return Err(Error::from_reason(
                "Reference storage requires a non-scalar reference argument",
            ));
        }
        None => {
            return Err(Error::from_reason(
                "Reference argument index exceeds the compiled signature",
            ));
        }
    };
    let capacity = capacity
        .map(|capacity| {
            let (negative, length, lossless) = capacity.get_u64();
            anyhow::ensure!(
                !negative && lossless,
                "Reference capacity must fit an unsigned platform size"
            );
            let length = usize::try_from(length)?;
            crate::value::checked_array_length(length)?;
            Ok(length)
        })
        .transpose();
    let capacity = native_result("reference capacity", capacity)?;
    native_result("reference storage", codec.validate_mode(mode))?;
    let mut owners = Vec::new();
    native_result(
        "reference owners",
        collect_seed_owners(codec.inner_codec(), seed, &mut owners, true),
    )?;
    let owners = owners
        .into_iter()
        .map(|owner| owner.retain_owned().unwrap_or(owner))
        .collect();
    let request = ReferenceRequest {
        codec: codec.clone(),
        seed: ReferenceSeed::new(&env, seed)?,
        mode,
        capacity,
        owners,
    };
    Ok(External::new(ReferenceStorage {
        identity: codec.identity(),
        request: RefCell::new(Some(request)),
    }))
}

pub(crate) fn collect_seed_owners(
    codec: &Codec,
    seed: Unknown<'_>,
    owners: &mut Vec<crate::handle::Handle>,
    include_transferred: bool,
) -> anyhow::Result<()> {
    if matches!(seed.get_type()?, ValueType::Null | ValueType::Undefined) {
        return Ok(());
    }
    if codec.is_handle_backed() {
        let handle: &External<crate::handle::Handle> = crate::value::read_napi(seed)?;
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
