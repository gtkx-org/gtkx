use std::cell::RefCell;
use std::collections::HashMap;
use std::io;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::sync::{Arc, Mutex, Weak};
use std::thread::JoinHandle;

use napi::Env;
use napi::bindgen_prelude::External;
use napi_derive::napi;

struct ActiveMonitor {
    cancellation: OwnedFd,
    thread: Option<JoinHandle<()>>,
}

impl Drop for ActiveMonitor {
    fn drop(&mut self) {
        let event = 1_u64;
        loop {
            let result = unsafe {
                libc::write(
                    self.cancellation.as_raw_fd(),
                    (&raw const event).cast(),
                    size_of::<u64>(),
                )
            };
            if result >= 0 || io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
                break;
            }
        }
        if let Some(thread) = self.thread.take() {
            let _result = thread.join();
        }
    }
}

#[derive(Default)]
struct WatchState {
    descriptor: Option<OwnedFd>,
    active: Option<ActiveMonitor>,
}

pub struct ProcessWatch {
    state: Arc<Mutex<WatchState>>,
}

thread_local! {
    static PROCESS_WATCHES: RefCell<HashMap<usize, Vec<Weak<Mutex<WatchState>>>>> = RefCell::new(HashMap::new());
}

fn register_watch(env: &Env, state: &Arc<Mutex<WatchState>>) -> napi::Result<()> {
    let key = env.raw() as usize;
    PROCESS_WATCHES.with_borrow_mut(|environments| {
        if let std::collections::hash_map::Entry::Vacant(entry) = environments.entry(key) {
            env.add_env_cleanup_hook(key, |key| {
                let watches = PROCESS_WATCHES.with_borrow_mut(|entries| entries.remove(&key));
                for state in watches
                    .into_iter()
                    .flatten()
                    .filter_map(|weak| weak.upgrade())
                {
                    *state
                        .lock()
                        .unwrap_or_else(std::sync::PoisonError::into_inner) = WatchState::default();
                }
            })?;
            entry.insert(Vec::new());
        }
        if let Some(watches) = environments.get_mut(&key) {
            if watches.len() % 64 == 0 {
                watches.retain(|weak| {
                    weak.upgrade().is_some_and(|state| {
                        let state = state
                            .lock()
                            .unwrap_or_else(std::sync::PoisonError::into_inner);
                        state.descriptor.is_some() || state.active.is_some()
                    })
                });
            }
            watches.push(Arc::downgrade(state));
        }
        Ok(())
    })
}

fn failure(error: &io::Error) -> napi::Error {
    napi::Error::from_reason(error.to_string())
}

fn process_exited(descriptor: &OwnedFd) -> io::Result<bool> {
    let mut descriptor = libc::pollfd {
        fd: descriptor.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    loop {
        let result = unsafe { libc::poll(&raw mut descriptor, 1, 0) };
        if result >= 0 {
            return Ok(result > 0);
        }
        let error = io::Error::last_os_error();
        if error.kind() != io::ErrorKind::Interrupted {
            return Err(error);
        }
    }
}

fn monitor(descriptor: &OwnedFd, cancellation: &OwnedFd, target: libc::pid_t) {
    let mut descriptors = [
        libc::pollfd {
            fd: descriptor.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        },
        libc::pollfd {
            fd: cancellation.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        },
    ];
    loop {
        let result = unsafe { libc::poll(descriptors.as_mut_ptr(), 2, -1) };
        if result < 0 && io::Error::last_os_error().kind() == io::ErrorKind::Interrupted {
            continue;
        }
        if descriptors[1].revents == 0 {
            unsafe { libc::kill(target, libc::SIGTERM) };
        }
        return;
    }
}

/// Opens an owned pidfd without applying process ancestry or identity policy.
/// Returns none when the kernel or sandbox does not permit pidfds.
#[napi(catch_unwind)]
pub fn open_process_watch(env: Env, pid: u32) -> napi::Result<Option<External<ProcessWatch>>> {
    let pid =
        libc::pid_t::try_from(pid).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    let descriptor = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) };
    if descriptor < 0 {
        let error = io::Error::last_os_error();
        return if matches!(
            error.raw_os_error(),
            Some(libc::ENOSYS | libc::EPERM | libc::EACCES)
        ) {
            Ok(None)
        } else {
            Err(failure(&error))
        };
    }
    let descriptor =
        i32::try_from(descriptor).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    let state = Arc::new(Mutex::new(WatchState {
        descriptor: Some(unsafe { OwnedFd::from_raw_fd(descriptor) }),
        active: None,
    }));
    register_watch(&env, &state)?;
    Ok(Some(External::new(ProcessWatch { state })))
}

/// Starts independent SIGTERM delivery on process exit. A dead process returns false.
/// Closing the watch, collecting it, or tearing down its environment cancels monitoring.
#[napi(catch_unwind)]
pub fn activate_process_watch(watch: &External<ProcessWatch>) -> napi::Result<bool> {
    let mut state = watch
        .state
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if state.active.is_some() {
        return Err(napi::Error::from_reason("Process watch is already active"));
    }
    let descriptor = state
        .descriptor
        .take()
        .ok_or_else(|| napi::Error::from_reason("Process watch is closed"))?;
    if process_exited(&descriptor).map_err(|error| failure(&error))? {
        return Ok(false);
    }
    let cancellation = unsafe { libc::eventfd(0, libc::EFD_CLOEXEC) };
    if cancellation < 0 {
        return Err(failure(&io::Error::last_os_error()));
    }
    let cancellation = unsafe { OwnedFd::from_raw_fd(cancellation) };
    let thread_cancellation = cancellation.try_clone().map_err(|error| failure(&error))?;
    let target = unsafe { libc::getpid() };
    let thread = std::thread::Builder::new()
        .name("gtkx-parent-death".to_owned())
        .spawn(move || monitor(&descriptor, &thread_cancellation, target))
        .map_err(|error| failure(&error))?;
    state.active = Some(ActiveMonitor {
        cancellation,
        thread: Some(thread),
    });
    Ok(true)
}

/// Cancels monitoring and synchronously releases all owned descriptors. May be repeated.
#[napi(catch_unwind)]
pub fn close_process_watch(watch: &External<ProcessWatch>) {
    *watch
        .state
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = WatchState::default();
}

#[napi(catch_unwind)]
pub fn arm_parent_death(expected_parent: u32) -> napi::Result<bool> {
    if unsafe { libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) } != 0 {
        return Err(failure(&io::Error::last_os_error()));
    }
    Ok(u32::try_from(unsafe { libc::getppid() }).ok() == Some(expected_parent))
}
