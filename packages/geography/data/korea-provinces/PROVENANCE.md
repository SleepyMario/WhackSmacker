# Korea provincial-level divisions

This teaching dataset combines the first-level administrative divisions of the Korean peninsula in one continuous map. It contains 28 units: 17 from the Republic of Korea dataset and 11 from the Democratic People's Republic of Korea dataset. The learner-facing menu and map are titled **Korea**. All first-level boundaries use the same line and fill treatment; the boundary between the two source countries is not emphasized as a separate country border.

Boundary source: geoBoundaries `gbOpen` ADM1 snapshots downloaded on 3 October 2026.

- Republic of Korea: `KOR-ADM1-68945753`, represented year 2021, sourced by geoBoundaries from Natural Earth, Public Domain.
- Democratic People's Republic of Korea: `PRK-ADM1-3916807`, represented year 2018, sourced by geoBoundaries from World Food Programme / OCHA ROAP, CC BY 3.0 IGO.

The retained source files are `source-kor-adm1.geojson` and `source-prk-adm1.geojson`. WhackSmacker changes the colours and label layout, generates numbered/named references, and creates one highlighted question/answer pair per division. The generated map is educational reference material, not a boundary survey or political-status statement.

The same retained geometries also generate independent **North** and **South** regional decks. North contains the 11 PRK first-level units and South contains the 17 ROK first-level units. Each regional deck resets its numbering, restricts choices to its own divisions, and uses region-only reference and highlighted maps. Regional artwork follows the canonical Wandering the World rule: retain the complete geography, maximize landmass size first, and then maximize readable labels, using external callouts where necessary. The original combined one-peninsula deck remains available and unchanged in scope.

Both regional sets use 20-point map numbers and 14-point name keys. External callouts preserve that full label size for compact metropolitan divisions.

- geoBoundaries API: https://www.geoboundaries.org/api.html
- KOR metadata: https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM1/
- PRK metadata: https://www.geoboundaries.org/api/current/gbOpen/PRK/ADM1/
- KOR source terms: https://www.naturalearthdata.com/about/terms-of-use/
- PRK source record: https://data.humdata.org/dataset/dpr-korea-administrative-boundaries
