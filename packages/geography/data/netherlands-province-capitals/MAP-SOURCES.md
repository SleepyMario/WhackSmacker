# Netherlands province-capital map sources

The twelve province outlines follow the validated Netherlands teaching inventory
in `packages/geography/data/netherlands-provinces`. Municipal boundaries use
geoBoundaries release `NLD-ADM2-6326949`, represented year 2022, sourced from
the Netherlands National Georegister and released under CC0 1.0.

Each answer map colours the municipality containing the provincial capital.
All municipal boundaries and capital geometry are hard-clipped to the province
outline, so no internal line can continue outside the province.
