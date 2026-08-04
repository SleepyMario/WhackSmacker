# General and Specialized Deck Families

Every language shown in the interactive CLI has two package-family entries:

```text
General Decks
Specialized Decks
```

The entries are always present. When no installed package belongs to a family for that language, the submenu shows `No General decks are available for this language.` or `No Specialized decks are available for this language.` Escape returns to the language menu through the normal tree navigation.

The ordinary memorization entry is learner-facing `Reading Decks`, replacing the former `Review decks` label in every language menu. This is a label-only change: internal Review/memorization terminology, launch behavior, commands, APIs, item kinds, and progress identities remain unchanged.

## Package metadata

Topic-deck packages declare one optional manifest property:

```json
{
  "deckFamily": "general",
  "relatedPackageIds": ["com.example.language.target"]
}
```

`deckFamily` accepts only `general` or `specialized`. The property is copied unchanged from the package manifest into the generated catalogue and installed-package registry. `relatedPackageIds` is the existing exact package-identity association: each listed language package receives the classified package. A package that intentionally supports more than one learner language lists each relevant language package identity explicitly.

Family is package/deck metadata, not lexical-entry metadata. Display names, package-ID substrings, filesystem names, and source paths never classify a package. Package IDs, package versions, memorization item IDs, and progress identity are independent of mutable display titles and are unchanged by this metadata.

An installed record that predates `deckFamily` may use the effective family and exact language associations from one unambiguous current package-metadata record with the same package ID, package version, and compatible content type. This reconciliation is read-only and never rewrites the installed registry. Display titles are not consulted. The current Dutch and Traditional Chinese Medical I package identities reconcile this way to `Specialized Decks` while retaining their exact package, item, and progress identities.

Packages that still have no exact compatible classified metadata continue to validate and remain in the legacy `Specialized` compatibility branch. That branch is only for genuinely unclassified older packages; a classified package is never duplicated between it and `Specialized Decks`. Ordinary curricula and their Review content remain under `Read content` and learner-facing `Reading Decks`.

Inside a family submenu, a package containing exactly one titled Review source uses that source's concise authoritative title for the package node. Its full descriptive package name remains available in package metadata and the package preview, and the existing Review-source child remains the launch target. A package with zero or multiple Review sources keeps its unambiguous package-level display name; multiple source titles remain visible below it. The two Medical I packages therefore appear simply as `Medical I` under their respective `Specialized Decks` submenus without changing classification, package identity, item identity, progress identity, or launch behavior.

## One topic-oriented source repository

Authoritative topic source belongs in one topic-oriented repository. The current physical repository is `language-curriculum-specialized`; its logical role is topic-oriented curriculum source. It may later be renamed `language-curriculum-topics`, but this runtime contract does not depend on that physical name. General and Specialized are generated deck families over shared canonical topic inventories, stable lexical identities, language-neutral media, and per-language localization layers. They are not separate repositories or permanent classifications of lexical entries. The same topic or stable lexical source may therefore generate packages in both families without duplicating source identity.

Topic sources are not copied into per-language curriculum repositories. Copying would create competing canonical inventories, localization drift, duplicate media, and unstable lexical identity. Per-language curriculum repositories continue to own ordinary reading curricula; the topic-oriented repository owns topic inventories and their localization layers.

The source/output boundary is:

```text
Authoritative topic source
  one topic-oriented repository
  canonical topic inventories
  language-neutral media
  General and Specialized deck manifests
  per-language localization layers
            |
            v
Generated runtime output
  .wspkg packages
  package catalogue/feed records
  installed read-only package copies
```

The CLI consumes generated manifest metadata preserved in installed/catalogued WSM packages. Its read-only compatibility overlay uses the same current package metadata compiled from the authoritative generator-target registry. It does not inspect Git repositories, source manifests, localization TSV files, or display titles at runtime.

## Making a generated topic package visible

To make a future package appear in a family submenu:

1. Generate a WSM package from the authoritative topic repository.
2. Give it a stable `packageId`, an explicit `deckFamily`, and exact `relatedPackageIds` for its learner-language associations.
3. Publish the same metadata in its generated catalogue/feed entry.
4. Install the package through the package manager.

The interactive CLI then discovers it from the installed registry, selects the newest installed version of each package ID, sorts packages by the existing display-name/package-ID convention, and shows it only under its declared family for the associated languages.
