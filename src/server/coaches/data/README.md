# Berlin training-area labels

`berlin-neighborhoods.json` is a generated, server-only reference for concise Home-card labels. It contains Berlin's official ALKIS **Ortsteile** (neighborhoods), not coach or account data. Only the derived label reaches the browser. Actual venues and scheduling continue to use the saved location record.

- Publisher: Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin.
- Dataset and license: [Berlin Open Data — ALKIS Berlin Ortsteile](https://daten.berlin.de/datensaetze/alkis-berlin-ortsteile-wfs-61bd3084), [Datenlizenz Deutschland — Zero 2.0](https://www.govdata.de/dl-de/zero-2-0).
- Retrieved: 2026-10-18. The source response hash is embedded in the generated file.
- Coordinate system: WGS84 longitude/latitude, requested as EPSG:4326 GeoJSON.
- Preparation: retain names and multipolygon rings/holes; simplify lines to two metres using a fixed Berlin metric projection; round to seven decimal places. The lookup uses a five-metre boundary guard and returns only Berlin for ambiguous border points. Points outside the dataset have no invented area label. This is a discovery label, not a legal boundary or navigation service.
- Size: 97 neighborhood records, approximately 360 KiB; loaded only by server modules. No runtime network call, new provider key or dependency.

To refresh deliberately from the public source:

```sh
curl -fsS 'https://gdi.berlin.de/services/wfs/alkis_ortsteile?service=WFS&version=2.0.0&request=GetFeature&typeNames=alkis_ortsteile:ortsteile&outputFormat=application/json&srsName=EPSG:4326' -o /tmp/berlin-ortsteile.geojson
python3 scripts/prepare-berlin-neighborhoods.py /tmp/berlin-ortsteile.geojson src/server/coaches/data/berlin-neighborhoods.json
```

Review source/license changes and run the area-label checks before adopting a refresh. The generated file is excluded from Prettier; the preparation script defines its format.
