//! Linux (X11 / XWayland) backends for the Win32 features: window focus, key
//! injection, global key listening and game window capture. Proton runs CoH as
//! an X11 client, so everything here talks to the X server through x11rb.

pub mod keys;
pub mod listener;
pub mod x11;
