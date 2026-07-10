# Localized Source Content

WhackSmacker package format v1 accepts learner-facing source text as either a plain string or a locale map:

```json
{
  "en-US": "English source text",
  "zh-Hant-TW": "繁體中文來源文字"
}
```

Plain strings remain valid and are treated as the English/default source content. Runtime selection is deterministic: selected locale, `en-US`, the first locale key in lexical order with a non-empty string, then an empty string.

Localized values are supported for package and catalogue `displayName` and `description`, source snapshot file `text`, and these memorization-item fields:

- `prompt.text` and `prompt.plainText`
- `answer.text` and `answer.plainText`
- each `hints` entry
- `notes`
- `source.title`
- `difficulty.label`

`examples` remain arrays of literal target-language strings. They are not localized because review examples must continue to match source reading content exactly.

Existing packages and generators do not need to change until localized source content is authored. Generator target metadata accepts the same string-or-map shape, and runtime package JSON preserves locale maps in manifests, catalogues, snapshots, and memorization collections.
