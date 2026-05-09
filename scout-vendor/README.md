# scout-vendor

This directory holds third-party or externally-derived vendor components that are
copied into `scout-lab` for isolated operation and controlled modification.

Current vendor packages:
- `mediacrawler/`: copied from `/Users/sourcefire/1data/workspace-ln/BeautyModel-Lab/BeautyQA-vendor/MediaCrawler`

Rules:
- do not assume vendor code is first-party
- preserve upstream license files and notices
- keep runtime state out of git
- prefer wrappers, adapters, and orchestration around vendor code before deep edits
