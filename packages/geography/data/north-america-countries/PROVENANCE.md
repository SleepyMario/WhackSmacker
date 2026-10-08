# North America countries and territories map provenance

Boundaries are adapted from Natural Earth Vector's public-domain
`ne_10m_admin_0_map_units` dataset, retrieved from the official
`nvkelso/natural-earth-vector` repository on 2026-10-05. Bonaire, Saba, and
Sint Eustatius are separated using Natural Earth's first-order administrative
geometry because the map-unit source groups them as Caribbean Netherlands.

This northern learner set contains Canada, the United States, Mexico,
Greenland, Bermuda, and Saint Pierre and Miquelon. Mexico is intentionally
included in North America. Central America and the Caribbean are maintained as
a separate regional study scope. Inclusion is geographic and educational; it
does not express a position about sovereignty or constitutional status.

The renderer in `scripts/generate-north-america-numbered-map.py` uses one
continuous continent-wide conic map. Hawaii is retained in a conventional
bottom-left inset without changing its shape. Wrapped Aleutian and unrelated
remote Pacific components are excluded. The map preserves shapes, relative
positions, and orientation. Bermuda and Saint Pierre and Miquelon use short
local leaders and receive an orange locator ring when highlighted.
