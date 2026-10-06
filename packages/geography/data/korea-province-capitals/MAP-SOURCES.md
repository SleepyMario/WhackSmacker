# Korea province-capital map sources

The deck follows the same visual and review structure as the Japanese
prefecture-capital decks. It uses the existing combined 28-area Korea teaching
inventory and does not divide the capital decks into northern and southern
branches.

First-level outlines come from the validated Korea provincial map dataset in
`packages/geography/data/korea-provinces`. Capital-city and county boundaries
use geoBoundaries ADM2 releases:

- Republic of Korea: `KOR-ADM2-91817680`, represented year 2020; source
  geoBoundaries / citypopulation.de, CC BY 3.0.
- Democratic People's Republic of Korea: `PRK-ADM2-82179303`, represented year
  2019; source World Food Programme / OCHA ROAP, CC BY 3.0 IGO.

For an ordinary province, the capital city or administrative county is coloured
inside the province. A first-level city is its own regional capital, so its
complete first-level outline is coloured while its internal district boundaries
remain visible where the source geometry permits.
