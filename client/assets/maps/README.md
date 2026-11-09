Land polygons from [Natural Earth v5.1.2](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_land.geojson).

Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
The local JSON retains geometry coordinates only. Scale is **1:10 million**, not 10 metre resolution. Coastlines are generalized; no claim of building detail, current reclamation, bathymetry or photographic satellite imagery. The renderer does not add fabricated urban textures over this map.

## Singapore regional imagery

`singapore-sentinel2-2016.jpg` is an unedited, georeferenced EOX WMS GetMap response (EPSG:4326, WMS 1.1.1), 4096 × 4096 pixels, bounding box **103.55° E, 1.08° N, 103.99° E, 1.52° N**. About 12 m per output pixel near Singapore; this does not provide the simulated camera's 3 m resolution. Historical mosaic, not current/live imagery. Buildings and roads appear only to the extent resolved by the source; no synthetic detail is added.

Attribution: [Sentinel-2 cloudless](https://s2maps.eu) by [EOX IT Services GmbH](https://eox.at) (Contains modified Copernicus Sentinel data 2016 & 2017), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

[Provider license statement](https://eox.at/2025/03/sentinel-2-cloudless-2024/#license). The 2016 release is used deliberately; newer vintages have different licensing conditions.

Source request: `https://tiles.maps.eox.at/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=s2cloudless&STYLES=&FORMAT=image/jpeg&SRS=EPSG:4326&BBOX=103.55,1.08,103.99,1.52&WIDTH=4096&HEIGHT=4096`.

The app crops this fixed local asset to the same sensor framing for viewing and capture. Imagery is never stretched outside its bounds. Outside coverage, during loading, or on failure, it uses the clearly labeled geographic coastline map. Existing version-1 illustrations and version-2 coastline captures are preserved; only new captures actually showing imagery record version 3 and its dataset identifier.
