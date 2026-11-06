#!/usr/bin/env python3
"""Build the playable ZIP for each migrated Arcade game.

FBNeo identifies a romset by the ZIP's file name, so each game's
playable file is named {romset}.zip (romset names identified by
scripts/identify-arcade-romsets.py against the official FBNeo dat).

Manual decisions layered on top of the automated matcher (evidence in
the Phase 2 notes): merged GGEMU zips contain the parent set's ROMs,
so the parent name wins close parent/clone calls; three games have no
FBNeo driver for their dump at all and stay on the GGEMU iframe.

Ten Neo Geo games ship without BIOS ROMs inside their zip; FBNeo
cannot boot those standalone, so the Neo Geo BIOS files (donated by
the KOF97 merged zip, whose dumps match this core's vintage) are
injected into their playable zip here.

Usage:
  python3 scripts/build-arcade-playable.py --staging ~/workspace/retroplay-roms

Output: playable zips at <staging>/{upstream_id}/{romset}.zip and
<staging>/arcade-playable.json {approved_id: {file, injected}}.
"""
import argparse
import json
import os
import shutil
import zipfile

# Parent-preference overrides for close parent/clone matcher calls.
OVERRIDES = {
    "the-king-of-fighters-99-arcade-1999": "kof99",
    "warriors-of-fate-ii-arcade-1992": "wof",
    "raiden-arcade-1990": "raiden",
    "captain-commando-arcade-1991": "captcomm",
    "raiden-ii-arcade-1993": "raiden2",
    "the-king-of-fighters-95-arcade-1995": "kof95",
}

# No FBNeo driver matches these dumps (Model 1 hardware, an unmatched
# Konami dump, an unidentifiable Taiwanese board): keep them off the
# local player so they continue on the GGEMU iframe.
EXCLUDED = {
    "virtua-fighter-arcade-1993",
    "tv-animation-slam-dunk-super-slams-arcade-1995",
    "min-guo-jiao-yu-wei-yuan-hui-arcade-1993",
}

# Neo Geo games whose zip lacks the BIOS ROMs (verified against the
# FBNeo dat: their set definition references Neo Geo BIOS files that
# are absent from the zip).
NEEDS_BIOS = {
    "fata-fury-3-arcade-1995",
    "metal-slug-3-arcade-2000",
    "metal-slug-4-arcade-2002",
    "metal-slug-5-arcade-2003",
    "real-bout-fata-fury-special-arcade-1997",
    "riding-hero-arcade-1990",
    "super-side-kicks-arcade-1992",
    "the-king-of-fighters-95-arcade-1995",
    "the-king-of-fighters-97-plus-arcade-1997",
    "top-hunter-roddy-and-cathy-arcade-1994",
}

BIOS_DONOR_UPSTREAM_ID = "69950bf6fa4c51c949bf3c9b"  # KOF97 merged zip
BIOS_MEMBERS = [
    "000-lo.lo", "asia-s3.rom", "sfix.sfx", "sm1.sm1", "sp-e.sp1",
    "sp-j2.rom", "sp-s.sp1", "sp-s2.sp1", "usa_2slt.bin", "vs-bios.rom",
]


def is_junk(name):
    return name.startswith("__MACOSX/") or "/__MACOSX/" in name \
        or name.startswith("TORRENTZIPPED-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", required=True)
    args = parser.parse_args()
    staging = args.staging

    with open(os.path.join(staging, "playable.json"), encoding="utf-8") as fh:
        playable = json.load(fh)
    with open(os.path.join(staging, "romsets.json"), encoding="utf-8") as fh:
        romsets = json.load(fh)
    by_approved = {p["approved_id"]: p for p in playable}

    donor = os.path.join(staging, BIOS_DONOR_UPSTREAM_ID, "game.zip")

    result = {}
    for approved_id, romset in sorted(romsets.items()):
        if approved_id in EXCLUDED or approved_id not in by_approved:
            continue
        romset = OVERRIDES.get(approved_id, romset)
        entry = by_approved[approved_id]
        src = os.path.join(staging, entry["upstream_id"], f"game.{entry['ext']}")
        target = os.path.join(staging, entry["upstream_id"], f"{romset}.zip")
        injected = approved_id in NEEDS_BIOS
        if injected:
            with zipfile.ZipFile(src) as zin, \
                    zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zout:
                present = set()
                for info in zin.infolist():
                    if info.is_dir() or is_junk(info.filename):
                        continue
                    zout.writestr(info.filename, zin.read(info.filename))
                    present.add(info.filename.lower())
                with zipfile.ZipFile(donor) as zdonor:
                    for member in BIOS_MEMBERS:
                        if member.lower() not in present:
                            zout.writestr(member, zdonor.read(member))
        else:
            shutil.copyfile(src, target)
        result[approved_id] = {
            "file": f"{romset}.zip",
            "injected": injected,
            "size": os.path.getsize(target),
        }

    with open(os.path.join(staging, "arcade-playable.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, sort_keys=True)
    print(json.dumps({
        "playable_arcade": len(result),
        "bios_injected": sum(1 for r in result.values() if r["injected"]),
        "total_bytes": sum(r["size"] for r in result.values()),
    }))


if __name__ == "__main__":
    main()
