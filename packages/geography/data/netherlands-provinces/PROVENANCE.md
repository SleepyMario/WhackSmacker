# Netherlands province map provenance

- Dataset: geoBoundaries `gbOpen` Netherlands ADM1 (`NLD-ADM1-6811986`)
- Canonical boundary type: Province
- Year represented: 2022
- Administrative units: 12
- Original source: National Georegister
- License: CC0 1.0 Universal public-domain dedication
- geoBoundaries metadata: <https://www.geoboundaries.org/api/current/gbOpen/NLD/ADM1/>
- Retained source: `source-nld-adm1.geojson`
- Generator: `scripts/generate-netherlands-provincial-maps.py`
- Physical masks: Natural Earth 1:10m `ne_10m_land`, `ne_10m_minor_islands`,
  `ne_10m_lakes`, and the supplementary `ne_10m_lakes_europe`; public domain,
  retained as GeoJSON source snapshots.

Generated maps use the official Dutch province names supplied by the source.
The physical masks keep het IJsselmeer and the Wadden Sea as water while
preserving the Wadden Islands, including Texel and Schiermonnikoog.
