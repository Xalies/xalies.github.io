# Add `.mvpack` export to an existing model generator

Use this document as the complete implementation brief for a developer or coding
assistant. It does not assume a programming language, framework, renderer,
backend, model format, or set of generator controls.

## Goal

Keep every existing export option unchanged. Add a separate **Export to
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
| Images already encoded as Base64 | Use `thumbnailDataBase64` and `extraImageDataBase64` |
| Generator settings | Serialise them into `printSettingsJson` |
| Several independently useful model files | Use the multi-model package form |

Omit unavailable optional fields. Do not invent authors, URLs, settings, images,
licences, dimensions, or other data.

## Single-model package

Use this form when one export produces one model file.

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
└── images/
    ├── thumbnail.png
    ├── front.jpg
    └── detail.webp
```

```json
{
  "schema": "meshvault.model",
  "version": 1,
  "exportedUtc": "2026-10-01T00:00:00Z",
  "title": "Generated Model",
  "author": "Generator or creator name",
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
  "fileName": "Generated-Model.3mf",
  "relativePath": "Generated-Model.3mf",
  "fileType": "3MF",
  "fileSizeBytes": 123456,
  "sha256": "optional-lowercase-sha256-of-the-model-file",
  "printedStatus": 0
}
```

Image paths are paths inside the ZIP. Use `/` separators, even when generating
the package on Windows. Paths must not be absolute and must not contain `.` or
`..` segments. Supported packaged image formats are PNG, JPEG, BMP, GIF and
WebP. Each image must be no larger than 50 MiB.

If both `thumbnailDataBase64` and `thumbnailFile` are supplied, Base64 is used.
Base64 and file-based extra-image arrays can both be supplied; their images are
combined.

### Package with Base64 images

Use this only when Base64 is already convenient:

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
| `author` | string | Creator or generator author |
| `authorUrl` | string | Creator profile URL |
| `sourceUrl` | string | Page where the model was generated |
| `summary` | string | Short plain-text summary |
| `tags` | string array | Search tags |
| `descriptionHtml` | string | Optional HTML description |
| `printSettingsJson` | string | JSON encoded as a string, or other useful print text |
| `packageInfo` | string | Generator or package information |
| `thumbnailFile` | string | ZIP path to the main image |
| `extraImageFiles` | string array | ZIP paths to gallery images |
| `thumbnailDataBase64` | string | Base64 main image |
| `extraImageDataBase64` | string array | Base64 gallery images |
| `fileName` | string | Model filename including extension |
| `relativePath` | string | Portable model path inside the ZIP |
| `fileType` | string | Extension without the leading dot |
| `fileSizeBytes` | integer | Model byte length |
| `sha256` | string | Lowercase SHA-256 of the model bytes |
| `printedStatus` | integer | Use `0` for a newly generated model |

Do not put a JSON object directly in `printSettingsJson`. Serialise the object to
a JSON string. In JavaScript, use `JSON.stringify(settings)`.

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

## Multi-model package

Use this only when one generator export intentionally contains several models
that should appear as separate MeshVault library items. Do not use the
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
3. Add a separate **Export to MeshVault** action.
4. Reuse the exact model bytes produced by the existing exporter.
5. Build only metadata the generator actually knows.
6. If a preview or gallery image is available, add its bytes as an ordinary ZIP
   entry and reference it with `thumbnailFile` or `extraImageFiles`.
7. Create `meshvault.model.json` for one model or `meshvault.models.json` for
   several models.
8. Create a standard, unencrypted ZIP containing the model, metadata and any
   referenced images.
9. Download or return the ZIP with a `.mvpack` filename and the MeshVault MIME
   type.
10. Surface packaging failures to the user. Do not silently download a partial
    or invalid package.

Use the ZIP library already present in the project. If there is none, use a
small, established ZIP implementation appropriate to the project's language and
runtime. Do not hand-write a new ZIP format implementation unless the platform
has no reasonable library.

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

if thumbnail bytes exist:
    zip.add("images/thumbnail.png", thumbnail bytes)
    metadata.thumbnailFile = "images/thumbnail.png"

if extra image bytes exist:
    for each image:
        add image under "images/"
        append its ZIP path to metadata.extraImageFiles

zip.add("meshvault.model.json", UTF8(JSON(metadata)))
output zip as "<model-name>.mvpack"
```

## Browser-specific notes

- Existing browser exporters commonly return a `Blob`, `ArrayBuffer`,
  `Uint8Array`, or text. Preserve those bytes.
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
- Every logical path uses `/` and contains no traversal segments.
- A root-level model imports into `Imports to Review`.
- A foldered model preserves its package folder from the MeshVault library root.
- MeshVault restores the available title, source, tags, description, settings,
  thumbnail and gallery images.
- Missing optional information does not block export.
- Packaging errors do not replace or break the generator's normal export.

## Copyable coding-assistant task

```text
Add an “Export to MeshVault” option to this existing model generator.

First inspect the project and identify the existing function that produces the
final model file. Reuse its output bytes. Do not rewrite the generator, change
the model geometry, remove existing export formats, or require a MeshVault API,
account, server or SDK.

Create a standard unencrypted ZIP and give it a .mvpack extension. For one model,
put exactly one supported model file and a UTF-8 meshvault.model.json at the ZIP
root. The minimum JSON is:
{"schema":"meshvault.model","version":1,"title":"<available title>"}

Include only metadata the project already knows. Optional supported properties
are exportedUtc, author, authorUrl, sourceUrl, summary, tags, descriptionHtml,
printSettingsJson, packageInfo, fileName, relativePath, fileType, fileSizeBytes,
sha256 and printedStatus. printSettingsJson must be a string.

If image bytes are available, store them as normal ZIP entries and reference
them with thumbnailFile and extraImageFiles. Base64 is optional; existing Base64
may instead use thumbnailDataBase64 and extraImageDataBase64. Do not invent
missing images or metadata.

Use / for all ZIP and relative paths. A model at the ZIP root will enter
“Imports to Review”. A path such as Generated/Example/model.3mf will be restored
from the MeshVault library root. Reject absolute and traversal paths.

Download the result as <model-name>.mvpack with MIME type
application/vnd.meshvault.package+zip. Use the project’s existing ZIP dependency
or an established platform-appropriate ZIP library. Preserve existing exports.
Add the smallest meaningful test that opens the generated ZIP and verifies the
model entry, metadata entry, parsed schema/title and referenced image entries.
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
