use std::cell::{RefCell, UnsafeCell};
use std::collections::BTreeSet;
use std::ffi::c_void;
use std::sync::OnceLock;

use glib::translate::FromGlib as _;
use napi::ValueType;
use napi::bindgen_prelude::{External, Unknown};

use crate::ffi::codec::Codec;
use crate::handle::{Boxed as NativeBoxed, Handle};

struct OwnedMatchInfo {
    references: UnsafeCell<i32>,
    base: MatchInfoRef,
    subject: Handle,
}

struct MatchInfoRef(*mut glib::ffi::GMatchInfo);

impl Drop for MatchInfoRef {
    fn drop(&mut self) {
        unsafe { glib::ffi::g_match_info_unref(self.0) };
    }
}

unsafe extern "C" fn copy_match_info(value: *mut c_void) -> *mut c_void {
    let info = value.cast::<OwnedMatchInfo>();
    unsafe { glib::ffi::g_atomic_ref_count_inc((*info).references.get()) };
    value
}

unsafe extern "C" fn free_match_info(value: *mut c_void) {
    let info = value.cast::<OwnedMatchInfo>();
    if unsafe { glib::ffi::g_atomic_ref_count_dec((*info).references.get()) } != 0 {
        drop(unsafe { Box::from_raw(info) });
    }
}

pub(crate) fn type_() -> glib::Type {
    static TYPE: OnceLock<glib::Type> = OnceLock::new();
    *TYPE.get_or_init(|| unsafe {
        glib::Type::from_glib(glib::gobject_ffi::g_boxed_type_register_static(
            c"GtkxMatchInfo".as_ptr(),
            Some(copy_match_info),
            Some(free_match_info),
        ))
    })
}

#[derive(Debug)]
pub(crate) struct MatchInfoPlan {
    subject_args: Vec<usize>,
}

impl MatchInfoPlan {
    pub(crate) fn contains(codec: &Codec) -> bool {
        Self::collect(codec, &mut BTreeSet::new())
    }

    pub(crate) fn compile(args: &[Codec], result: &Codec) -> Option<Self> {
        let mut subjects = BTreeSet::new();
        let mut found = false;
        for codec in args.iter().chain(std::iter::once(result)) {
            found |= Self::collect(codec, &mut subjects);
        }
        found.then(|| Self {
            subject_args: subjects.into_iter().collect(),
        })
    }

    fn collect(codec: &Codec, subjects: &mut BTreeSet<usize>) -> bool {
        match codec {
            Codec::MatchInfo(info) => {
                subjects.extend(info.subject_arg_index);
                true
            }
            Codec::Ref(reference) => Self::collect(reference.inner_codec(), subjects),
            Codec::Array(array) => Self::collect(&array.item_codec, subjects),
            Codec::HashTable(table) => {
                let keys = Self::collect(&table.key_codec, subjects);
                Self::collect(&table.value_codec, subjects) || keys
            }
            Codec::Callback(callback) => match &callback.signature.match_info {
                Some(plan) => {
                    subjects.extend(&plan.subject_args);
                    true
                }
                None => false,
            },
            _ => false,
        }
    }

    pub(crate) fn validate(&self, args: &[Codec]) -> anyhow::Result<()> {
        for &index in &self.subject_args {
            anyhow::ensure!(
                matches!(args.get(index), Some(Codec::Buffer(_))),
                "MatchInfo subject argument {index} must name a buffer argument of the enclosing call"
            );
        }
        Ok(())
    }
}

#[derive(Default)]
struct SubjectFrame {
    subjects: Vec<(*const c_void, Handle)>,
    holders: Vec<Handle>,
}

thread_local! {
    static SUBJECTS: RefCell<Vec<SubjectFrame>> = const { RefCell::new(Vec::new()) };
}

pub(crate) struct SubjectScope<'a> {
    plan: &'a MatchInfoPlan,
    frame_index: usize,
}

impl<'a> SubjectScope<'a> {
    pub(crate) fn open(plan: &'a MatchInfoPlan) -> Self {
        let frame_index = SUBJECTS.with_borrow_mut(|frames| {
            let index = frames.len();
            frames.push(SubjectFrame::default());
            index
        });
        Self { plan, frame_index }
    }

    pub(crate) fn capture(&self, index: usize, value: Unknown<'_>) -> anyhow::Result<()> {
        if self.plan.subject_args.binary_search(&index).is_err() {
            return Ok(());
        }
        anyhow::ensure!(
            value.get_type()? == ValueType::External,
            "MatchInfo requires native-owned regex subject storage"
        );
        let handle: &External<Handle> = crate::value::read_napi(value)?;
        let pointer = subject_pointer(handle)?;
        SUBJECTS.with_borrow_mut(|frames| {
            if let Some(frame) = frames.get_mut(self.frame_index) {
                frame.subjects.push((pointer, (**handle).clone()));
            }
        });
        Ok(())
    }

    pub(crate) fn validate(&self) -> anyhow::Result<()> {
        let subjects = SUBJECTS.with_borrow(|frames| {
            frames
                .get(self.frame_index)
                .map(|frame| frame.subjects.clone())
                .unwrap_or_default()
        });
        for (pointer, subject) in subjects {
            anyhow::ensure!(
                subject_pointer(&subject)? == pointer,
                "MatchInfo subject storage changed during argument production"
            );
        }
        Ok(())
    }
}

impl Drop for SubjectScope<'_> {
    fn drop(&mut self) {
        let frame = SUBJECTS.with_borrow_mut(Vec::pop);
        drop(frame);
    }
}

fn subject_pointer(subject: &Handle) -> anyhow::Result<*const c_void> {
    anyhow::ensure!(
        subject.is_owned_struct(),
        "MatchInfo requires native-owned regex subject storage"
    );
    let length = subject
        .allocated_bytes()
        .filter(|length| *length > 0)
        .ok_or_else(|| anyhow::anyhow!("MatchInfo subject storage has no bounded bytes"))?;
    let data = crate::api::handle_memory_range(subject, 0, length, "MatchInfo subject")?;
    anyhow::ensure!(
        unsafe { *data.cast::<u8>().add(length - 1) } == 0,
        "MatchInfo subject bytes must end with NUL"
    );
    Ok(data.cast_const())
}

pub(crate) fn project(holder: &Handle) -> anyhow::Result<*mut c_void> {
    anyhow::ensure!(
        holder.boxed_type() == Some(type_()),
        "Expected a boxed GtkxMatchInfo handle"
    );
    let pointer = crate::api::handle_memory_ptr(holder, "MatchInfo input")?;
    let info = unsafe { &*pointer.cast::<OwnedMatchInfo>() };
    let subject = subject_pointer(&info.subject)?;
    SUBJECTS.with_borrow_mut(|frames| {
        if let Some(frame) = frames.last_mut() {
            frame.subjects.push((subject, info.subject.clone()));
            frame.holders.push(holder.clone());
        }
    });
    Ok(info.base.0.cast())
}

pub(crate) unsafe fn own(
    pointer: *mut c_void,
    transfer: crate::ffi::codec::Ownership,
) -> anyhow::Result<Handle> {
    let pointer = pointer.cast::<glib::ffi::GMatchInfo>();
    let base = MatchInfoRef(if transfer.is_full() {
        pointer
    } else {
        unsafe { glib::ffi::g_match_info_ref(pointer) }
    });
    let subject_pointer = unsafe { glib::ffi::g_match_info_get_string(pointer) }.cast::<c_void>();
    let subject = SUBJECTS.with_borrow(|frames| {
        frames.iter().rev().find_map(|frame| {
            frame
                .subjects
                .iter()
                .rev()
                .find(|(pointer, _)| *pointer == subject_pointer)
                .map(|(_, owner)| owner.clone())
        })
    });
    let subject = subject.ok_or_else(|| {
        anyhow::anyhow!("MatchInfo does not reference a retained subject of the enclosing call")
    })?;
    let info = Box::new(OwnedMatchInfo {
        references: UnsafeCell::new(0),
        base,
        subject,
    });
    unsafe { glib::ffi::g_atomic_ref_count_init(info.references.get()) };
    Ok(NativeBoxed::from_glib_full(type_(), Box::into_raw(info).cast()).into())
}

pub(crate) unsafe extern "C" fn unref(pointer: *mut c_void) {
    unsafe { glib::ffi::g_match_info_unref(pointer.cast()) };
}
