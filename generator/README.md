# MeshVault generator integration guide

This folder publishes the framework-independent `.mvpack` integration guide at
`/generator/`. The complete machine-readable instructions are in
[`mvpack-integration.md`](mvpack-integration.md).

The page intentionally contains no model generator or packaging SDK. Generator
authors keep their existing export implementation and create a standard ZIP
containing their generated model plus MeshVault metadata.

Working examples are available in [Vessel Studio](../generators/vessels/),
[Gridfinity Studio](../generators/gridfinity/),
[Assembly Studio](../generators/assembly/) and
[Bracket Works](../generators/brackets/). All preserve their STL/3MF exports
and add a separate `.mvpack` action, using only fields useful to each generator.

The ready-to-import vase example is published as
[`samples/meshvault-vase-demo.mvpack`](samples/meshvault-vase-demo.mvpack). It is
identical to the Core-tested sample in the MeshVault repository; update both
when replacing it. Branding and support URLs in the example are placeholders.

Assembly demonstrates `packType: "project"` with shared illustrated instructions.
Gridfinity plate sets declare `packType: "collection"` for separate library items.

Bracket Works demonstrates editable author/profile details, separate author and
generator support links, and a YouTube embed with a watch-link fallback.
