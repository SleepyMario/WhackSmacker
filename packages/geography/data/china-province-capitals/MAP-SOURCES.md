# China province-capital map sources

The province outlines follow the validated 33-division China teaching inventory
in `packages/geography/data/china-divisions`. Lower-level boundaries come from
geoBoundaries release `CHN-ADM2-17275852` (represented year 2017, PDDL).

For an ordinary province or autonomous region, the capital's lower-level area
is coloured inside the first-level outline. Beijing, Tianjin, Shanghai,
Chongqing, Hong Kong and Macau are first-level municipalities or special
administrative regions whose complete first-level outline is coloured.

Every lower-level boundary is hard-clipped to the first-level outline so no
line can continue outside the province, municipality, autonomous region or SAR.
