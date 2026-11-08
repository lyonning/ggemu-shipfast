#!/usr/bin/env python3
"""Repair missing PGM BIOS files inside the arcade playable zips.

Root cause (2026-11-07, reported by Hosu for 傲剑狂刀 / killbld):
FBNeo 1.0.0.03 requires every PGM game to carry the full parent
``pgm`` BIOS romset (6 files, merged from the parent). GGEMU's packs
ship only some of them, so all six locally hosted PGM games fail in
the local player with "one of your romsets is missing files":

- killbld    0/6 BIOS files (傲剑狂刀 — the reported game)
- kov2p      4/6 (missing ddp3_bios.u37, bios.u42)
- theglad    4/6 (same two missing)
- kovplus    3/6 (missing pgm_p02s.u20, ddp3_bios.u37, bios.u42)
- olds       3/6 (same three missing)
- py2k2      3/6 (same three missing)

Donor BIOS payload: ``pgm-donor.zip`` in the staging dir — the
FBNeo 1.0.0.03 ``pgm.zip`` BIOS set (RetroBIOS/Abdess/retrobios,
SHA1 6bbbce094422062bd178d6007bed06dcdd0d8b78, 2,190,114 bytes).
Every member was verified against the FBNeo dat CRCs, and
``ddp3_bios.u37`` was independently cross-checked against GGEMU's
own 怒首领蜂 3 pack (storage.ggemu.com/games/69c8a9485060110bbb3d8506,
same CRC b3cc5c8f). GGEMU hosts no game that owns ``bios.u42``
(espgalbl/ketbl/ddpdojblkbl are absent from its catalog), which is
why the donor comes from outside GGEMU this time.

Usage:
  python3 scripts/repair-pgm-bios.py --staging ~/workspace/retroplay-roms \
      --out-dir /tmp/pgm-repaired

Rebuilt zips land in <out-dir>/{upstream_id}/v20261107/{romset}.zip
(the cache-busting path layout used by the 2026-11-07 Neo Geo BIOS
repair, because the Cloudflare token has no Cache Purge permission).
Repo files are NOT modified: the script prints the exact
local-roms.json / arcade-playable.json edits to apply, and writes a
manifest.json next to the rebuilt zips. Upload the rebuilt zips to
R2 bucket ``retroplay-roms`` under the same keys, apply the edits,
commit, and redeploy Worker ``retro`` (with the DATA_BUCKET binding).
"""
import argparse
import binascii
import json
import os
import xml.etree.ElementTree as ET
import zipfile

PGM_SLUGS = {
    "the-killing-blade-arcade-1998": "killbld",
    "knights-of-valour-2-plus-arcade-2000": "kov2p",
    "the-legend-of-sword-and-saber-arcade-2003": "theglad",
    "knights-of-valour-plus-arcade-1999": "kovplus",
    "oriental-legend-arcade-1997": "olds",
    "photo-y2k-2-adult-arcade": "py2k2",
}


def crc_of(info):
    return format(info.CRC & 0xFFFFFFFF, "08x")


def crc_bytes(data):
    return format(binascii.crc32(data) & 0xFFFFFFFF, "08x")


def is_junk(name):
    return name.startswith("__MACOSX/") or "/__MACOSX/" in name \
        or name.startswith("TORRENTZIPPED-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()
    staging = args.staging
    out_dir = args.out_dir

    tree = ET.parse(os.path.join(staging, "fbneo-arcade.dat"))
    games = {g.get("name"): g for g in tree.getroot().iter("game")}
    pgm_game = games["pgm"]
    bios_want = {r.get("name"): (r.get("crc") or "").lower()
                 for r in pgm_game.iter("rom")}
    assert len(bios_want) == 6, f"expected 6 pgm BIOS files, got {bios_want}"

    donor_path = os.path.join(staging, "pgm-donor.zip")
    donor_bios = {}
    with zipfile.ZipFile(donor_path) as zd:
        for info in zd.infolist():
            name = info.filename
            assert name in bios_want, f"donor has unexpected file {name}"
            assert crc_of(info) == bios_want[name], f"donor {name} CRC mismatch"
            donor_bios[name] = zd.read(name)
    assert set(donor_bios) == set(bios_want), "donor lacks BIOS files"
    print(f"donor BIOS verified against dat: {len(donor_bios)}/6")

    with open(os.path.join(staging, "romsets.json"), encoding="utf-8") as fh:
        romsets = json.load(fh)
    with open(os.path.join(staging, "arcade-playable.json"), encoding="utf-8") as fh:
        arcade = json.load(fh)
    reg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "config", "local-roms.json")
    with open(reg_path, encoding="utf-8") as fh:
        reg = json.load(fh)

    bios_crcs = set(bios_want.values())
    manifest = {"rebuilt": [], "donor_sha1": "6bbbce094422062bd178d6007bed06dcdd0d8b78"}
    for slug, romset in sorted(PGM_SLUGS.items()):
        assert romsets[slug] == romset, f"romset mismatch for {slug}"
        upstream_id = reg[slug]["id"]
        src = os.path.join(staging, upstream_id, "game.zip")
        rel = f"v20261107/{romset}.zip"
        target = os.path.join(out_dir, upstream_id, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        # Full dat requirement for this game: own ROMs + merged parent ROMs.
        game = games[romset]
        want = {}
        for r in game.iter("rom"):
            crc = (r.get("crc") or "").lower()
            if crc:
                want[crc] = r.get("name")
        with zipfile.ZipFile(src) as zin:
            members = list(zin.infolist())
            old_size = os.path.getsize(src)
            with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zout:
                kept = 0
                for item in members:
                    if item.is_dir() or is_junk(item.filename):
                        continue
                    if crc_of(item) in bios_crcs:
                        continue  # drop stale/renamed BIOS member; donor adds it
                    zout.writestr(item.filename, zin.read(item.filename))
                    kept += 1
                for name, payload in sorted(donor_bios.items()):
                    zout.writestr(name, payload)
        # Verify the rebuilt zip against the dat: every required ROM
        # present with the exact CRC, and no game ROM lost.
        with zipfile.ZipFile(target) as zcheck:
            have = {}
            for info in zcheck.infolist():
                have[crc_bytes(zcheck.read(info.filename))] = info.filename
        missing = [(c, n) for c, n in want.items() if c not in have]
        assert not missing, f"{slug}: still missing {missing}"
        new_size = os.path.getsize(target)
        old = arcade[slug]
        manifest["rebuilt"].append({
            "slug": slug,
            "romset": romset,
            "upstream_id": upstream_id,
            "r2_key": f"{upstream_id}/{rel}",
            "old_file": old.get("served_file") or old["file"],
            "old_size": old["size"],
            "new_file": rel,
            "new_size": new_size,
            "local_roms_file": rel,
        })
        print(f"{slug}: {romset}.zip {old['size']} -> {new_size} bytes "
              f"(kept {kept} game members + 6 BIOS), dat check OK")

    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=True)
    print(f"manifest: {manifest_path}")
    print("Apply after R2 upload:")
    for entry in manifest["rebuilt"]:
        print(f"  local-roms.json {entry['slug']}.file = {entry['new_file']!r} ; "
              f"arcade-playable.json {entry['slug']}.served_file = {entry['new_file']!r}, "
              f"size = {entry['new_size']}, bios_repaired = true")


if __name__ == "__main__":
    main()
