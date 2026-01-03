use std::ffi::{CString, c_void};

use anyhow::bail;
use gtk4::glib;

use super::owned_ptr::OwnedPtr;
use super::Value;
use crate::{arg, types::*, value};

pub(super) fn try_from_hashtable(arg: &arg::Arg, type_: &HashTableType) -> anyhow::Result<Value> {
    let tuples = match &arg.value {
        value::Value::Array(arr) => arr,
        value::Value::Null | value::Value::Undefined if arg.optional => {
            return Ok(Value::Ptr(std::ptr::null_mut()));
        }
        _ => bail!(
            "Expected an Array of tuples for GHashTable type, got {:?}",
            arg.value
        ),
    };

    match (&*type_.key_type, &*type_.value_type) {
        (Type::String(_), Type::String(_)) => {
            try_from_string_string_hashtable(tuples)
        }
        (Type::Integer(_), Type::Integer(_)) => {
            try_from_int_int_hashtable(tuples)
        }
        (Type::String(_), Type::Integer(_)) => {
            try_from_string_int_hashtable(tuples)
        }
        (Type::Integer(_), Type::String(_)) => {
            try_from_int_string_hashtable(tuples)
        }
        _ => bail!(
            "Unsupported GHashTable key/value types: {:?}/{:?}",
            type_.key_type,
            type_.value_type
        ),
    }
}

fn try_from_string_string_hashtable(tuples: &[value::Value]) -> anyhow::Result<Value> {
    let hash_table = unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_str_hash),
            Some(glib::ffi::g_str_equal),
            Some(glib::ffi::g_free),
            Some(glib::ffi::g_free),
        )
    };

    let mut owned_strings: Vec<CString> = Vec::new();

    for tuple in tuples {
        let (key, val) = extract_tuple(tuple)?;

        let key_str = match key {
            value::Value::String(s) => s,
            _ => bail!("Expected string key in GHashTable tuple, got {:?}", key),
        };
        let val_str = match val {
            value::Value::String(s) => s,
            _ => bail!("Expected string value in GHashTable tuple, got {:?}", val),
        };

        let key_cstr = CString::new(key_str.as_bytes())?;
        let val_cstr = CString::new(val_str.as_bytes())?;

        unsafe {
            let key_dup = glib::ffi::g_strdup(key_cstr.as_ptr());
            let val_dup = glib::ffi::g_strdup(val_cstr.as_ptr());
            glib::ffi::g_hash_table_insert(
                hash_table,
                key_dup as *mut c_void,
                val_dup as *mut c_void,
            );
        }

        owned_strings.push(key_cstr);
        owned_strings.push(val_cstr);
    }

    Ok(Value::OwnedPtr(OwnedPtr::new(
        (hash_table, owned_strings),
        hash_table as *mut c_void,
    )))
}

fn try_from_int_int_hashtable(tuples: &[value::Value]) -> anyhow::Result<Value> {
    let hash_table = unsafe {
        glib::ffi::g_hash_table_new(Some(glib::ffi::g_direct_hash), Some(glib::ffi::g_direct_equal))
    };

    for tuple in tuples {
        let (key, val) = extract_tuple(tuple)?;

        let key_num = match key {
            value::Value::Number(n) => *n as isize,
            _ => bail!("Expected number key in GHashTable tuple, got {:?}", key),
        };
        let val_num = match val {
            value::Value::Number(n) => *n as isize,
            _ => bail!("Expected number value in GHashTable tuple, got {:?}", val),
        };

        unsafe {
            glib::ffi::g_hash_table_insert(
                hash_table,
                key_num as *mut c_void,
                val_num as *mut c_void,
            );
        }
    }

    Ok(Value::OwnedPtr(OwnedPtr::new(hash_table, hash_table as *mut c_void)))
}

fn try_from_string_int_hashtable(tuples: &[value::Value]) -> anyhow::Result<Value> {
    let hash_table = unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_str_hash),
            Some(glib::ffi::g_str_equal),
            Some(glib::ffi::g_free),
            None,
        )
    };

    let mut owned_strings: Vec<CString> = Vec::new();

    for tuple in tuples {
        let (key, val) = extract_tuple(tuple)?;

        let key_str = match key {
            value::Value::String(s) => s,
            _ => bail!("Expected string key in GHashTable tuple, got {:?}", key),
        };
        let val_num = match val {
            value::Value::Number(n) => *n as isize,
            _ => bail!("Expected number value in GHashTable tuple, got {:?}", val),
        };

        let key_cstr = CString::new(key_str.as_bytes())?;

        unsafe {
            let key_dup = glib::ffi::g_strdup(key_cstr.as_ptr());
            glib::ffi::g_hash_table_insert(hash_table, key_dup as *mut c_void, val_num as *mut c_void);
        }

        owned_strings.push(key_cstr);
    }

    Ok(Value::OwnedPtr(OwnedPtr::new(
        (hash_table, owned_strings),
        hash_table as *mut c_void,
    )))
}

fn try_from_int_string_hashtable(tuples: &[value::Value]) -> anyhow::Result<Value> {
    let hash_table = unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            Some(glib::ffi::g_free),
        )
    };

    let mut owned_strings: Vec<CString> = Vec::new();

    for tuple in tuples {
        let (key, val) = extract_tuple(tuple)?;

        let key_num = match key {
            value::Value::Number(n) => *n as isize,
            _ => bail!("Expected number key in GHashTable tuple, got {:?}", key),
        };
        let val_str = match val {
            value::Value::String(s) => s,
            _ => bail!("Expected string value in GHashTable tuple, got {:?}", val),
        };

        let val_cstr = CString::new(val_str.as_bytes())?;

        unsafe {
            let val_dup = glib::ffi::g_strdup(val_cstr.as_ptr());
            glib::ffi::g_hash_table_insert(hash_table, key_num as *mut c_void, val_dup as *mut c_void);
        }

        owned_strings.push(val_cstr);
    }

    Ok(Value::OwnedPtr(OwnedPtr::new(
        (hash_table, owned_strings),
        hash_table as *mut c_void,
    )))
}

fn extract_tuple(value: &value::Value) -> anyhow::Result<(&value::Value, &value::Value)> {
    match value {
        value::Value::Array(arr) if arr.len() == 2 => Ok((&arr[0], &arr[1])),
        _ => bail!("Expected [key, value] tuple in GHashTable, got {:?}", value),
    }
}
