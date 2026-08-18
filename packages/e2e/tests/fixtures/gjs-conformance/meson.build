project(
    'gtkx-gjs-conformance',
    'c',
    version: '1.0.0',
    meson_version: '>=1.0.0',
)

gnome = import('gnome')
gobject = dependency('gobject-2.0')

conformance = shared_library(
    'gtkx-conformance-1.0',
    'gtkx-conformance.c',
    dependencies: gobject,
    install: false,
)

gnome.generate_gir(
    conformance,
    sources: [
        'gtkx-conformance.c',
        'gtkx-conformance.h',
    ],
    namespace: 'GtkxConformance',
    nsversion: '1.0',
    identifier_prefix: 'GtkxConformance',
    symbol_prefix: 'gtkx_conformance',
    includes: ['GObject-2.0'],
    dependencies: gobject,
    fatal_warnings: true,
    extra_args: [
        '--c-include=gtkx-conformance.h',
        '--strict',
        '--warn-all',
    ],
    install: false,
)
