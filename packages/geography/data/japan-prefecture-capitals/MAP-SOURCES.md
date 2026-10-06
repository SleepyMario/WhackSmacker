# Prefecture-capital map sources

The map deck uses municipality boundaries derived from Japan's Ministry of Land,
Infrastructure, Transport and Tourism (MLIT) National Land Numerical Information
administrative-area dataset (`N03`, 2021). The working GeoJSON was the 1% simplified
municipality edition published by SmartNews Media Research Institute:

- https://github.com/smartnews-smri/japan-topography
- upstream MLIT source: https://nlftp.mlit.go.jp/ksj/

SmartNews permits commercial and non-commercial use without requiring SmartNews
credit; the MLIT source credit is retained in every rendered image. The generator
uses the `N03_003` designated-city field or `N03_004` municipality/ward field to
identify the administrative seat. Tokyo deliberately highlights Shinjuku Ward.
Remote territory for Tokyo, Kagoshima, and Okinawa is retained in an inset so the
capital-bearing main map remains legible.
