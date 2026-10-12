use std::cell::RefCell;
use std::collections::HashMap;

use napi::Env;
use napi::bindgen_prelude::*;

use super::ClosureHandle;

thread_local! {
    static ROOTS: RefCell<HashMap<usize, ClosureHandle>> = RefCell::new(HashMap::new());
}

fn map(env: &Env) -> Result<Object<'_>> {
    ROOTS.with_borrow_mut(|roots| {
        let key = env.raw() as usize;
        if let std::collections::hash_map::Entry::Vacant(entry) = roots.entry(key) {
            let constructor: Function<'_, (), Unknown<'_>> =
                env.get_global()?.get_named_property("WeakMap")?;
            let map = constructor.new_instance(())?;
            let retained = ClosureHandle::from_js_value(env, &map)?;
            env.add_env_cleanup_hook(key, |key| {
                ROOTS.with_borrow_mut(|roots| roots.remove(&key));
            })?;
            entry.insert(retained);
        }
        roots
            .get(&key)
            .ok_or_else(|| Error::from_reason("The native ownership roots are unavailable"))?
            .get(env)
    })
}

fn entry<'e>(env: &'e Env, key: Unknown<'e>) -> Result<Option<Object<'e>>> {
    let map = map(env)?;
    let get: Function<'_, Unknown<'_>, Unknown<'_>> = map.get_named_property("get")?;
    let value = get.apply(map, key)?;
    if value.get_type()? == ValueType::Undefined {
        Ok(None)
    } else {
        Object::from_unknown(value).map(Some)
    }
}

/// Keeps ownership dependencies visible to V8, including cycles through callback captures.
pub(crate) fn set(env: Env, key: Unknown<'_>, slot: &str, value: Unknown<'_>) -> Result<()> {
    let mut entry = if let Some(entry) = entry(&env, key)? {
        entry
    } else {
        let entry = Object::new(&env)?;
        let map = map(&env)?;
        let set: Function<'_, FnArgs<(Unknown<'_>, Object<'_>)>, Unknown<'_>> =
            map.get_named_property("set")?;
        set.apply(map, FnArgs::from((key, entry)))?;
        entry
    };
    entry.set_named_property(slot, value)
}

pub(crate) fn get<'e>(env: &'e Env, key: Unknown<'e>, slot: &str) -> Result<Unknown<'e>> {
    match entry(env, key)? {
        Some(entry) => entry.get_named_property(slot),
        None => ().into_unknown(env),
    }
}

pub(crate) fn remove(env: Env, key: Unknown<'_>, slot: &str) -> Result<()> {
    if let Some(mut entry) = entry(&env, key)? {
        entry.delete_named_property(slot)?;
    }
    Ok(())
}
