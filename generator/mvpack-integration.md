# Add `.mvpack` export to an existing model generator

Use this document as the complete implementation brief for a developer or coding
assistant. It does not assume a programming language, framework, renderer,
backend, model format, or set of generator controls.

Last checked against MeshVault Core on 6 October 2026.

MeshVault is downloadable software released for Windows, Linux and macOS. Users
keep their own libraries; generator integration requires no cloud SaaS account.

A complete [vase sample package](samples/meshvault-vase-demo.mvpack) is available
for import and ZIP inspection. It includes a 3MF, two images, generation settings
and print notes. Its generator name and example.org URLs are placeholders.
Desktop link placement and physical printing require manual verification.

## Goal

Keep every existing export option unchanged. Add a separate **Export for
MeshVault** action that packages the model bytes the generator already produces.
The package is created entirely by the generator website or application. It does
not call a MeshVault API, upload the model to MeshVault, require an account, or
require a MeshVault SDK.

An `.mvpack` file is a standard, unencrypted ZIP archive with a different file
extension and this MIME type:

```text
application/vnd.meshvault.package+zip
```

Use ordinary ZIP Store or Deflate compression and UTF-8 entry names.

## Choose the smallest supported integration

The generator does not need to provide every field.

| Capability available in the generator | What to include |
| --- | --- |
| Model bytes only | The model file and minimum metadata JSON |
| Title or source page | Add the available metadata fields |
| Preview image as a file or Blob | Add it to the ZIP and use `thumbnailFile` |
| Gallery images as files or Blobs | Add them to the ZIP and use `extraImageFiles` |
| Images already encoded as Base64 | Prefer decoding into image files and referencing their ZIP paths |
| Instructions, PDFs or other reference files | Add them to the ZIP and use `documentFiles` |
| Generation parameters | Attach a JSON file through `documentFiles` |
| Printing advice or printer settings | Add useful text or serialised JSON to `printSettingsJson` |
| Referenced materials, buffers or textures | Include the dependent files with their relative layout |
| Generator name and support page | Add `generatorName` and optional `exportDonationUrl` |
| Several independently useful model files | Use the multi-model package form |

Omit unavailable optional fields. Do not invent authors, URLs, settings, images,
licences, dimensions, or other data.

## Single-model package

Use this form when one export produces one model file. Supply an available
title, or derive it from the model filename when the generator has no title.

### Minimum package layout

```text
Generated-Model.mvpack
├── Generated-Model.stl
└── meshvault.model.json
```

The archive must contain exactly one supported model file. The model can be STL,
3MF, OBJ, STEP, G-code, LYS, or any other model type MeshVault supports. Preserve
the generator's existing format; do not convert it just for MeshVault.

`meshvault.model.json` must be UTF-8 JSON at the archive root:

```json
{
  "schema": "meshvault.model",
  "version": 1,
  "title": "Generated Model"
}
```

### Package with image files

This is the recommended form when the generator has image bytes, a Canvas, a
Blob, a file, or a server-side image but does not already use Base64:

```text
Generated-Model.mvpack
├── Generated-Model.3mf
├── meshvault.model.json
├── images/
│   ├── thumbnail.png
│   ├── front.jpg
│   └── detail.webp
└── documents/
    └── instructions.pdf
```

```json
{
  "schema": "meshvault.model",
  "version": 1,
  "exportedUtc": "2026-10-01T00:00:00Z",
  "title": "Generated Model",
  "author": "Model designer name",
  "generatorName": "Example Generator",
  "exportDonationUrl": "https://example.org/support",
  "authorUrl": "https://example.com/creator",
  "sourceUrl": "https://example.com/generator",
  "summary": "Created with Example Generator",
  "tags": ["generated", "custom"],
  "descriptionHtml": "<p>Description supplied by the generator.</p>",
  "printSettingsJson": "{\"material\":\"PLA\",\"layerHeightMm\":0.2}",
  "packageInfo": "Generated with Example Generator",
  "thumbnailFile": "images/thumbnail.png",
  "extraImageFiles": [
    "images/front.jpg",
    "images/detail.webp"
  ],
  "documentFiles": [
    "documents/instructions.pdf"
  ],
  "fileName": "Generated-Model.3mf",
  "relativePath": "Generated-Model.3mf",
  "fileType": "3MF",
  "fileSizeBytes": 123456,
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}
```

The example byte length and hash are illustrative: compute them from the actual
model bytes or omit them. Do not copy those values.

Image paths are paths inside the ZIP. Use `/` separators, even when generating
the package on Windows. Paths must not be absolute and must not contain `.` or
`..` segments. Supported packaged image formats are PNG, JPEG, BMP, GIF and
WebP. Each image must be no larger than 50 MiB.

If both `thumbnailDataBase64` and `thumbnailFile` are supplied, Base64 is used.
Base64 and file-based extra-image arrays can both be supplied; their images are
combined.

### Reference attachments

Instructions, colour guides, generation parameters and other reference files can
be stored as ordinary ZIP entries listed in `documentFiles`. Any file type is
accepted. MeshVault attaches them to the model through Documents or Related files.
Each attachment is limited to 10 MiB, with at most ten attachments per model.
PDF filenames must end in `.pdf` and their contents must begin with a PDF
signature; other file types are opaque bytes. Use the same safe ZIP path rules
as images. Store attachments as files, not Base64 metadata fields.

Attach design parameters as, for example, `documents/generator-settings.json`.
MeshVault preserves the file; it does not automatically regenerate a model from
those settings. `printSettingsJson` describes printing, not generator controls.
Do not hide extra supported model files among attachments in a single-model
package: they count towards its one-model limit. Use multi-model metadata when
several supported models are intentionally included.

### Package with Base64 images

This remains accepted for existing integrations. New integrations should prefer
actual image files, including when the source can be decoded from Base64:

```json
{
  "schema": "meshvault.model",
  "version": 1,
  "title": "Generated Model",
  "thumbnailDataBase64": "iVBORw0KGgoAAA...",
  "extraImageDataBase64": [
    "iVBORw0KGgoAAA...",
    "/9j/4AAQSkZJRgABAQ..."
  ]
}
```

Raw Base64 is preferred. A `data:image/...;base64,` prefix is also accepted.

## Metadata fields

JSON property names are case-sensitive. Only `schema`, `version`, and `title`
are required by this public integration profile; every other field is optional.

| Property | Type | Meaning |
| --- | --- | --- |
| `schema` | string | Must be `meshvault.model` |
| `version` | integer | Must be `1` |
| `exportedUtc` | string | ISO 8601 UTC export time |
| `title` | string | Human-readable model title |
| `author` | string | Person who designed the model; omit if unknown |
| `generatorName` | string | Name of the generating site or tool |
| `exportDonationUrl` | string | Optional HTTPS support page for the generator |
| `authorUrl` | string | Creator profile URL |
| `sourceUrl` | string | Page where the model was generated |
| `summary` | string | Short plain-text summary |
| `tags` | string array | Search tags |
| `descriptionHtml` | string | Optional HTML description |
| `printSettingsJson` | string | JSON encoded as a string, or other useful print text |
| `packageInfo` | string | Generator or package information |
| `thumbnailFile` | string | ZIP path to the main image |
| `extraImageFiles` | string array | ZIP paths to gallery images |
| `documentFiles` | string array | ZIP paths to attached reference files of any type |
| `thumbnailDataBase64` | string | Base64 main image |
| `extraImageDataBase64` | string array | Base64 gallery images |
| `fileName` | string | Model filename including extension |
| `relativePath` | string | Portable model path inside the ZIP |
| `fileType` | string | Extension without the leading dot |
| `fileSizeBytes` | integer | Model byte length |
| `sha256` | string | Lowercase SHA-256 of the model bytes |

Do not put a JSON object directly in `printSettingsJson`. Serialise the object to
a JSON string. In JavaScript, use `JSON.stringify(settings)`.

## Generator credit and donation link

`author` identifies the model designer; `generatorName` identifies the site or
tool. Do not put the generator creator into `author` unless they also designed
the model. These fields are separate in single-model and multi-model metadata.

An optional `exportDonationUrl` must be an absolute HTTPS URL without embedded
username or password. It can point to the generator's own support page, Ko-fi,
Buy Me a Coffee or another donation service. Missing or blank means no link.
Invalid optional links are ignored without discarding the other metadata.
The unreleased `donationUrl` spelling is not supported; use `exportDonationUrl`.

Model details show “Created by [author]” when known, then “Generated with
[generatorName]” and a discreet “Support [generatorName]” link in the attribution
area. Without a generator name, the support label is “Support the generator”.
The link opens only when clicked; there are no automatic redirects or pop-ups.
The donation supports the generator and is separate from model authorship.

Printed status is personal library state. **Do not export `printedStatus`**,
even as `0`. It is not restored from imported package metadata. Printing advice
and `printSettingsJson` remain supported.

## Model dependencies

Include every locally referenced model dependency, preserving its path relative
to the referencing file. OBJ models may need `mtllib` material files and their
texture maps. glTF/GLB may need external buffers and images. Embedded data URIs
need no separate file. Decode percent-escaped glTF filenames for ZIP entry names,
but retain the model's original URI. Quote OBJ material-library names containing
spaces. Preserve the model bytes rather than rewriting its references.

```text
Generated/vase.obj
Generated/materials/vase.mtl
Generated/textures/colour.png
meshvault.model.json
```

Here the OBJ can refer to `materials/vase.mtl`; that MTL can refer to
`../textures/colour.png`. ZIP entry names must have no `.` or `..` segments,
but references within model files can use them if resolution stays inside the
package and library. Use `/` for canonical package paths. Missing files,
absolute/remote references, symbolic-link destinations and references into
MeshVault's private library data fail visibly. Do not fetch remote resources
as part of import.

Resources shared by models may share one ZIP entry when their bytes agree.
Different contents at the same dependency path are a conflict. During import,
identical existing files may be reused; different existing contents fail before
extraction and are never overwritten. Inconsistent reference filename casing
can break portability; use exact matching case everywhere.

Automatic dependency restoration currently covers OBJ material/texture references
and glTF/GLB buffer/image references. Do not assume other formats restore
external resources automatically; prefer a self-contained model or verify the
actual import outcome.

No extra dependency manifest is required for these formats: MeshVault follows
model references.
This preserves resources without promising that every preview renderer displays
all materials or format extensions. Metadata images and attachments may use
any safe ZIP paths. Keep them distinct from model resources; MeshVault's own
exports move metadata assets under an available `mvpack-metadata` folder when
needed. Consumers should follow metadata references, not fixed folder names.

## Destination folders

The model entry path controls its initial MeshVault location:

```text
model.stl
```

A root-level model has no declared folder, so MeshVault places it in `Imports to
Review`. The user can then choose where it belongs.

```text
Generated/My Generator/model.stl
```

A foldered model is installed from the MeshVault library root using that portable
path. Use `/` separators. Do not use absolute paths, drive letters, leading `/`,
`.` segments, or `..` segments.

For a single-model package, `relativePath` should match the model entry path. If
it is omitted, MeshVault uses the entry path.

## Package identity

New multi-model exports declare `packType` at the root of
`meshvault.models.json` (or its packed `.mvdata` equivalent):

- `project`: one library item, retaining the `.mvpack` archive and accessible
  parts. Put shared descriptive metadata in the root `project` object.
- `collection`: separate library items, with metadata in each `models` entry.

The declaration is authoritative; import and archive-review options cannot
change it. Unknown types fail visibly. Existing unmarked packages retain their
legacy import behaviour. Use a MeshVault build with project-package support;
older builds may ignore the declaration and split a project.

```json
{
  "schema": "meshvault.models",
  "version": 1,
  "packType": "project",
  "project": {
    "title": "Display riser",
    "author": "Xalies",
    "descriptionHtml": "<h2>Assembly</h2><p>Fit the rails into the frames.</p>",
    "thumbnailFile": "images/assembled.png",
    "documentFiles": ["documents/assembly-guide.html"]
  },
  "models": [
    {"fileName": "frame.3mf", "relativePath": "Parts/frame.3mf"},
    {"fileName": "rail.3mf", "relativePath": "Parts/rail.3mf"}
  ]
}
```

Include every declared part and referenced resource in the ZIP. Declare every
supported model file exactly once. Paths must be portable and safe. The project
object accepts the same descriptive fields, images and attachments as a model.
HTML rendering varies between clients; an attached offline guide preserves the
full instructions and embedded pictures.

Project placement uses optional `project.relativePath`, such as
`Furniture/display-riser.mvpack`. Without a declared folder, the retained archive
goes into **Imports to Review**. Internal paths such as `Parts/frame.3mf` describe
archive contents and do not place the project in a library folder. Review still
lets users organise the item; its project identity is fixed. Re-export preserves
that identity and the parts, without wrapping another `.mvpack` around them.

## Multi-model collection

Use `packType: "collection"` when one generator export intentionally contains
several models that should appear as separate MeshVault library items. Do not use the
single-model metadata file when the ZIP contains more than one supported model.

```text
Generated-Set.mvpack
├── Parts/base.stl
├── Parts/lid.stl
├── images/base.png
├── images/lid.png
└── meshvault.models.json
```

```json
{
  "schema": "meshvault.models",
  "version": 1,
  "packType": "collection",
  "exportedUtc": "2026-10-01T00:00:00Z",
  "models": [
    {
      "schema": "meshvault.model",
      "version": 1,
      "title": "Generated Base",
      "fileName": "base.stl",
      "relativePath": "Parts/base.stl",
      "thumbnailFile": "images/base.png"
    },
    {
      "schema": "meshvault.model",
      "version": 1,
      "title": "Generated Lid",
      "fileName": "lid.stl",
      "relativePath": "Parts/lid.stl",
      "thumbnailFile": "images/lid.png"
    }
  ]
}
```

Every model object must contain `fileName`. Include `relativePath` and make it
exactly match that model's ZIP entry. A SHA-256 hash may be included as `sha256`
for additional matching.

## Implementation steps

1. Locate the generator's existing export boundary: the function that already
   returns or downloads the final model bytes.
2. Do not rewrite the geometry generator and do not remove or change its normal
   export buttons.
3. Add a separate **Export for MeshVault** action.
4. Reuse the exact model bytes produced by the existing exporter.
5. Build only metadata the generator actually knows.
6. If preview images, gallery images or reference attachments are available, add their
   bytes as ordinary ZIP entries and reference them with `thumbnailFile`,
   `extraImageFiles` or `documentFiles`.
7. Create `meshvault.model.json` for one model or `meshvault.models.json` for
   several models, declaring `packType` as `project` or `collection`.
8. Create a standard, unencrypted ZIP containing the model, its local dependencies, metadata and
   referenced images and attachments.
9. Download or return the ZIP with a `.mvpack` filename and the MeshVault MIME
   type.
10. Surface packaging failures to the user. Do not silently download a partial
    or invalid package.

Use the ZIP library already present in the project. If there is none, use the
runtime's standard ZIP API or add a small, established library through the
project's normal dependency system. For browser JavaScript or TypeScript,
`fflate` or `JSZip` are suitable choices; a no-build static site can keep a
pinned local copy. Do not hand-write ZIP headers, CRC handling or central
directory records in browser code. If the project forbids dependencies, package
on its existing server or report that constraint instead of inventing a ZIP
writer.

## Framework-neutral pseudocode

```text
model = existingGeneratorExport()

metadata = {
  schema: "meshvault.model",
  version: 1,
  title: availableTitleOrFileStem,
  fileName: model.fileName,
  relativePath: chosenPortablePath
}

zip.add(chosenPortablePath, model.bytes)
add all locally referenced model dependencies, preserving relative layout
if a required dependency is missing or conflicts: fail visibly
if model designer is known: metadata.author = designer name
if generator name is known: metadata.generatorName = generator name
if a valid HTTPS support URL exists: metadata.exportDonationUrl = support URL
never add printedStatus

if thumbnail bytes exist:
    zip.add("images/thumbnail.png", thumbnail bytes)
    metadata.thumbnailFile = "images/thumbnail.png"

if extra image bytes exist:
    for each image:
        add image under "images/"
        append its ZIP path to metadata.extraImageFiles

if reference attachment bytes exist:
    for each attachment:
        add attachment under "documents/"
        append its ZIP path to metadata.documentFiles

zip.add("meshvault.model.json", UTF8(JSON(metadata)))
output zip as "<model-name>.mvpack"
```

## Browser-specific notes

- Existing browser exporters commonly return a `Blob`, `ArrayBuffer`,
  `Uint8Array`, or text. Preserve those bytes.
- Use the project's existing ZIP dependency. If it has none, use `fflate` or
  `JSZip` rather than implementing ZIP records yourself.
- A Canvas thumbnail can be converted to a PNG `Blob` with `canvas.toBlob()`.
- Use a Blob URL and an `<a download>` element for the final download.
- Revoke the Blob URL after starting the download.
- Packaging must happen in response to a user action so browsers permit the
  download.
- The generator may package on its own server instead. The resulting file format
  is identical.

## Required acceptance checks

An implementation is complete when all applicable checks pass:

- Existing exports still produce byte-identical model files.
- The new filename ends in `.mvpack`.
- The download MIME type is `application/vnd.meshvault.package+zip` where the
  platform lets the application set it.
- An ordinary ZIP reader can open the package.
- A single-model package contains exactly one supported model file.
- The correct metadata filename exists at the ZIP root.
- Metadata is valid UTF-8 JSON with the correct schema and version.
- Every referenced image path exists in the ZIP and contains a supported image.
- Every referenced document path exists in the ZIP and contains at most
  10 MiB; no model references more than ten attachments. PDFs have a PDF signature.
- Every ZIP entry path uses `/` and contains no traversal segments.
- Every local model dependency is present and resolves inside the package.
- Model author and generator credit remain separate.
- Optional support links use `exportDonationUrl` and HTTPS without credentials.
- No metadata object includes `printedStatus`.
- A root-level model imports into `Imports to Review`.
- A foldered model preserves its package folder from the MeshVault library root.
- MeshVault restores the available title, source, tags, description, settings,
  thumbnail, gallery images, generator credits and attachments.
- Missing optional information does not block export.
- Packaging errors do not replace or break the generator's normal export.

## Copyable coding-assistant task

```text
Add an “Export for MeshVault” option to this existing model generator.

First inspect the project and identify the existing function that produces the
final model file. Reuse its output bytes. Do not rewrite the generator, change
the model geometry, remove existing export formats, or require a MeshVault API,
account, server or SDK.

Create a standard unencrypted ZIP and give it a .mvpack extension. For one model,
put exactly one supported model file and a UTF-8 meshvault.model.json at the ZIP
root. The minimum JSON is:
{"schema":"meshvault.model","version":1,"title":"<available title>"}

Include only metadata the project already knows. Optional supported properties
are exportedUtc, author, authorUrl, generatorName, exportDonationUrl, sourceUrl,
summary, tags, descriptionHtml, printSettingsJson, packageInfo, fileName, relativePath, fileType, fileSizeBytes,
sha256. printSettingsJson must be a string. Never export printedStatus.
The author is the model designer; generatorName is the site/tool. Use
exportDonationUrl for its optional HTTPS support link, without credentials.
Do not use donationUrl.

If image bytes are available, store them as normal ZIP entries and reference
them with thumbnailFile and extraImageFiles. Base64 is optional; existing Base64
may instead use thumbnailDataBase64 and extraImageDataBase64; new integrations
should prefer decoding to image files. Do not invent
missing images or metadata.

If the generator has instructions, design parameters or other attachments,
store them as ZIP files and list their paths in documentFiles. Any file type is
accepted, at most ten per model and 10 MiB each; PDFs require a PDF signature.
Attach generator parameters as JSON. Do not encode attachments as Base64.
Include every locally referenced OBJ material/texture and glTF/GLB buffer/image
with its relative layout. Embedded data URIs need no extra file. Fail visibly
on missing dependencies or conflicting paths; do not download remote references.

Use / for all ZIP and relative paths. A model at the ZIP root will enter
“Imports to Review”. A path such as Generated/Example/model.3mf will be restored
from the MeshVault library root. Reject absolute and traversal paths.

Download the result as <model-name>.mvpack with MIME type
application/vnd.meshvault.package+zip. Use the project’s existing ZIP dependency
or an established platform-appropriate ZIP library. In browser JavaScript or
TypeScript with no existing ZIP dependency, use fflate or JSZip; do not
hand-write ZIP headers or CRC logic. Preserve existing exports.
Add the smallest meaningful test that opens the generated ZIP and verifies the
model entry, metadata entry, parsed schema/title and referenced image entries.
Also verify dependency and attachment entries, separate author/generator credits,
valid optional support URLs and the absence of printedStatus. Test a real
MeshVault import from the download when that runtime is available.
```

## Supported model extensions

Common generator outputs include `.stl`, `.3mf`, `.obj`, `.step`, `.stp`,
`.gcode`, `.glb`, `.gltf`, `.ply`, `.fbx`, `.amf`, `.lys` and `.scad`.
MeshVault also accepts `.3dm`, `.3ds`, `.abc`, `.bgcode`, `.blend`, `.blend1`,
`.catpart`, `.catproduct`, `.cnc`, `.dae`, `.dwfx`, `.dwg`, `.dxf`, `.f3d`,
`.fcstd`, `.gco`, `.iam`, `.ifc`, `.iges`, `.igs`, `.ipt`, `.jt`, `.nc`,
`.off`, `.sat`, `.sab`, `.shapr`, `.skp`, `.sldasm`, `.sldprt`, `.usd`,
`.usda`, `.usdc`, `.usdz`, `.vrml`, `.wrl`, `.x_b`, `.x_t` and `.x3d`.

If the generator emits an unsupported type, keep its existing export but do not
claim that the resulting `.mvpack` is currently importable by MeshVault.
