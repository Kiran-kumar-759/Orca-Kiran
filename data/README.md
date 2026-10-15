# ORCA Local Datasets Directory

This directory stores offline data files, scientific cache subsets, and processed geospatial assets.

## Directory Layout

- `data/raw/`: External raw datasets, GeoJSON files, or CSVs. Large binary files (.nc, .geotiff, .grib) must remain in object storage or local scratch and are ignored by git.
- `data/processed/`: Normalized GeoJSON layers, bounding boxes, and processed fixture snapshots for offline tests.

## Data Policy

- Never commit confidential API credentials or proprietary spatial boundaries.
- Respect open dataset licensing and attribution requirements (e.g. OpenStreetMap ODbL, CC-BY 4.0).
