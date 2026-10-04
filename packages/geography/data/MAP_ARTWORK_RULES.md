# Canonical map artwork rules

These rules apply to every topographic or administrative map used by Wandering
the World. Language-localized copies in Lingoland use the same cartographic and
layout rules; only their learner-facing language changes.

The approved high-density Japan prefecture map is the reference for crowded
labels and leader lines. Belgium is the reference for direct labels and maximum
landmass use, Vietnam for shape-dependent regional layouts, Korea for compact
metropolitan divisions, Germany for a large external key, and Spain for distant
island treatment. These are reference cases, not fixed templates.

## Priority order

Resolve competing needs in this order:

1. complete and correct studied geography;
2. maximum practical studied-landmass size;
3. maximum practical and consistent label size;
4. unambiguous human-readable spacing;
5. decorative balance.

Human ambiguity is a failure even when the underlying coordinates are
mathematically correct.

## Geographic integrity

1. Use authoritative geometry and the boundaries and names appropriate to the
   deck's current or explicitly historical scope.
2. Preserve geographic proportions. Geography may be translated or uniformly
   scaled, but must not be stretched along one axis.
3. Keep north up unless a separately approved map has a documented reason not
   to do so.
4. Keep every studied province, prefecture, state, region, island, or equivalent
   unit fully inside the artwork with a small visible safety margin.
5. Retain relevant islands and detached components. A distant group may use a
   clearly identified inset with an independent uniform scale.
6. Do not add modern internal borders to a historical map when they are outside
   its chosen period.
7. Show neighboring geography only when it supplies useful context. Render it
   neutrally so it cannot be mistaken for an answer.
8. Omitting a tiny remote component requires an explicit documented decision;
   inconvenience alone is not sufficient.

## Canvas, scale, and orientation

9. Render maps directly on the cream artwork canvas. Do not add an unnecessary
   framed inner map panel.
10. Enlarge the studied landmass until territory, required insets, labels, or
    the safety margin reaches the available limit.
11. Do not preserve empty space merely for symmetry when the geography can be
    enlarged without clipping or distortion.
12. Move keys and external labels toward the canvas edge rather than shrinking
    the map needlessly.
13. Choose portrait, landscape, or top-down paired artwork from the shape of the
    studied geography. Do not force every map into one arrangement.
14. Very horizontal geography should normally use a wide map area or a
    map-above/text-below layout. Vertically shaped geography may use a portrait
    or side-by-side layout.
15. Question text and choices appear below a map that occupies the main artwork
    width. Preserve the map-first, question-second order consistently.
16. Numbered, named, neutral-reference, highlighted-question, revealed-answer,
    and localized assets in one family must use the same approved geographic
    extent and compatible layout.

## National and regional scope

17. An All deck uses the complete national study map.
18. A regional deck uses the complete regional map for its overview, reference,
    questions, and answers. Do not shrink the full country into a regional
    question.
19. Regional answer choices come only from the region being studied.
20. Regional numbering restarts locally when that is the established deck
    design.
21. Regional artwork may use an independent scale and orientation so its units
    are as large and readable as possible.
22. Every member of a regional artwork family must include the same complete
    regional territory, including relevant islands.

## Numbers, names, and keys

23. Use the largest practical label size after the landmass has been maximized.
24. Ordinary map numbers in one artwork use one consistent size. Never shrink a
    single difficult number merely to force it inside a small area.
25. Put a number or name inside its area when it is unquestionably readable and
    does not obscure the area shape.
26. Use an external label and leader line when an internal label would overlap a
    border, collide with another label, require a smaller font, obscure the
    geography, or become ambiguous.
27. Direct names may replace a side legend when the areas are large enough, as
    in the approved Belgium provinces map.
28. When a key is clearer, place it in compact columns beside or below the map.
    Do not reserve a large mostly empty legend panel.
29. Learner-facing labels use the deck's declared language. Language-localized
    copies retain the approved geometry and placement while translating their
    labels.

## Leader lines

30. A leader line starts clearly inside the correct area. Its origin may not be
    in a neighbor or in open water.
31. After leaving its source, route the line through open canvas whenever
    possible.
32. A line must not cross an unrelated studied territory, island, number, name,
    or another leader line.
33. Place external numbers and names in open water or unused canvas, never on a
    different land area.
34. Leave several visibly clear pixels between a line and unrelated geography
    at the actual WhackSmacker display size. Merely avoiding mathematical
    intersection is insufficient.
35. Keep the geographic origin fixed when adjusting a line for clearance; move
    its endpoint and label and change its angle instead.
36. Prefer straight horizontal, vertical, or single-angle lines. Use a bent line
    only when no clear straight route exists.
37. Make a line long enough that its source is obvious and it cannot be mistaken
    for a border fragment.
38. Align groups of external labels into orderly rows or columns when clarity
    permits. Alignment never overrides geographic clearance.
39. Keep consistent space between a line endpoint and its label.
40. Automatic small-polygon detection may propose callouts, but every callout
    requires visual inspection.

## Insets

41. Use an inset when a dense area is unreadable at the main-map scale or when a
    distant island group would otherwise make the principal landmass too small.
42. Identify an inset as enlarged or displaced, and preserve the proportions of
    the geography shown inside it.
43. Do not imply that a displaced inset occupies its displayed canvas location.
44. Apply the same label-size, line-clearance, and clipping rules inside insets.
45. Prefer an internal label in an enlarged inset when the unit has become large
    enough; do not preserve an unnecessary external callout.

## Question and answer assets

46. A highlighted question and its revealed answer use the same geometry,
    extent, scale, and placement. Only the intended reveal or label changes.
47. Highlighting must preserve borders, recognizable shapes, and all retained
    components of the selected unit.
48. Generate the numbered map, named map, neutral reference, question maps, and
    answer maps from the same approved geometry and layout configuration where
    the artwork type permits it.
49. Do not overwrite one artwork type with another merely because both concern
    the same geography. A validated numbered overview replaces numbered
    overviews; named and highlighted assets require their matching variants.
50. After geometry or layout changes, regenerate and inspect the complete
    affected artwork family.

## Required visual validation

51. Inspect final raster assets at the size and layout used by WhackSmacker, not
    only at source resolution.
52. Check every number and name against the administrative-unit metadata.
53. For every callout, verify that its origin is in the intended area, its path
    avoids unrelated territory, its clearance is visibly sufficient, its label
    uses the standard size, and the association is obvious without consulting
    source code.
54. Check all artwork edges for clipped territory, lines, labels, titles, keys,
    and inset contents.
55. Inspect dense metropolitan areas, narrow coastal units, compact islands,
    and groups of adjacent callouts separately.
56. Validate every affected numbered, named, reference, question, answer, and
    localized asset. Approval of one overview does not prove the others.

The builder may automate geometry loading, uniform fitting, bounds checks,
regional filtering, local numbering, stable colors, shared question/answer
transforms, and initial callout candidates. Final orientation, inset choice,
callout routing, visible clearance, and human readability remain visual review
decisions.
