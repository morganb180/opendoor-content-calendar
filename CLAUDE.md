# Claude Workflow Contract

When an asset is picture-locked, register it in this repo before ending the session.

Use the local CLI from the repo root:

```sh
tools/calctl add --title "Back-to-school opener" --theme seasonal --fmt "Static · 4:5" --date 2026-08-24 --img ~/opendoor/finals/back-to-school/preview.png --canva DAH_SAMPLE01 --social-caption "Ready before the first bell."
tools/calctl deploy -m "Add back-to-school opener"
```

Carousel example:

```sh
tools/calctl add --title "Offer math carousel" --theme proof --fmt "Carousel · 6 slides" --inventory --img ~/opendoor/finals/offer-math/cover.png --slides ~/opendoor/finals/offer-math/slides --caption "Proof carousel for late August."
```

Video example:

```sh
tools/calctl add --title "Move-in found footage" --theme brand --fmt "Video · 4:3" --inventory --img ~/opendoor/finals/movein/poster.jpg --video https://raw.githubusercontent.com/morganb180/canva-asset-host/main/assets/movein.mp4
```

Do not commit mp4 files to this repo. If the only video is local, upload it to the asset host first, or use `--allow-local` only when the calendar should honestly be Morgan-machine-only playback.

Before deploy, run:

```sh
tools/calctl validate
tools/calctl optimize-images
```
