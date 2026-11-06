#!/usr/bin/env python3
"""Repair stale Neo Geo BIOS dumps inside the arcade playable zips.

GGEMU's older Neo Geo packs carry pre-current dumps of three BIOS
files FBNeo hard-requires with exact CRCs (sm1.sm1 94416d67,
sfix.sfix c2ea0cfd, 000-lo.lo 5a86cff2), so the local player rejects
those games with 'one of your romsets is missing files'. A newer
GGEMU pack (The Last Blade, outside the migrated batch) carries the
current dumps; this script rebuilds every affected game's playable
zip from its original game.zip, swapping all Neo Geo BIOS members
for the donor's current ones.

Usage:
  python3 scripts/repair-neogeo-bios.py --staging ~/workspace/retroplay-roms

Rebuilt zips replace <staging>/{upstream_id}/{romset}.zip in place;
arcade-playable.json sizes are updated. Prints a JSON summary.
"""
import argparse
import json
import os
import xml.etree.ElementTree as ET
import zipfile

MANDATORY = {"sm1.sm1": "94416d67", "sfix.sfix": "c2ea0cfd", "000-lo.lo": "5a86cff2"}
# Name variants of BIOS files in the older packs (same content slot,
# outdated name) that must be dropped when the current set is added.
LEGACY_BIOS_NAMES = {"sfix.sfx"}

OVERRIDES = {
    "the-king-of-fighters-99-arcade-1999": "kof99",
    "warriors-of-fate-ii-arcade-1992": "wof",
    "raiden-arcade-1990": "raiden",
    "captain-commando-arcade-1991": "captcomm",
    "raiden-ii-arcade-1993": "raiden2",
    "the-king-of-fighters-95-arcade-1995": "kof95",
}


def crc_of(info):
    return format(info.CRC & 0xFFFFFFFF, "08x")


def is_junk(name):
    return name.startswith("__MACOSX/") or "/__MACOSX/" in name \
        or name.startswith("TORRENTZIPPED-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", required=True)
    args = parser.parse_args()
    staging = args.staging

    # Canonical Neo Geo BIOS set (name -> crc) from the FBNeo dat.
    tree = ET.parse(os.path.join(staging, "fbneo-arcade.dat"))
    bios_want = {}
    romof = {}
    cloneof = {}
    for game in tree.getroot().iter("game"):
        if game.get("name") == "neogeo" and game.get("isbios") == "yes":
            bios_want = {(r.get("name") or "").lower(): (r.get("crc") or "").lower()
                         for r in game.iter("rom")}
        if game.get("romof"):
            romof[game.get("name")] = game.get("romof")
        if game.get("cloneof"):
            cloneof[game.get("name")] = game.get("cloneof")

    def depends_on_neogeo(romset):
        # Clone sets point romof/cloneof at their parent, not at the
        # BIOS set; walk the chain to the root.
        seen = set()
        current = romset
        while current and current not in seen:
            if current == "neogeo" or romof.get(current) == "neogeo":
                return True
            seen.add(current)
            current = cloneof.get(current) or romof.get(current)
        return False

    # Donor BIOS payload: every donor member that belongs to the BIOS
    # set, verified against the dat CRCs.
    donor_path = os.path.join(staging, "lastblade-donor.zip")
    donor_bios = {}
    with zipfile.ZipFile(donor_path) as zd:
        for info in zd.infolist():
            name = info.filename.lower()
            if name in bios_want and crc_of(info) == bios_want[name]:
                donor_bios[info.filename] = zd.read(info.filename)
    for name, crc in MANDATORY.items():
        assert any(k.lower() == name for k in donor_bios), f"donor lacks {name}"
    print(f"donor BIOS files verified against dat: {len(donor_bios)}/{len(bios_want)}")

    with open(os.path.join(staging, "romsets.json"), encoding="utf-8") as fh:
        romsets = json.load(fh)
    with open(os.path.join(staging, "arcade-playable.json"), encoding="utf-8") as fh:
        arcade = json.load(fh)
    reg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "config", "local-roms.json")
    with open(reg_path, encoding="utf-8") as fh:
        reg = json.load(fh)

    drop_names = set(bios_want) | LEGACY_BIOS_NAMES
    rebuilt, skipped = [], []
    for approved_id, info in sorted(arcade.items()):
        romset = OVERRIDES.get(approved_id, romsets[approved_id])
        if not depends_on_neogeo(romset):
            continue
        upstream_id = reg[approved_id]["id"]
        game_dir = os.path.join(staging, upstream_id)
        src = os.path.join(game_dir, "game.zip")
        target = os.path.join(game_dir, info["file"])
        with zipfile.ZipFile(src) as zin:
            members = {i.filename.lower(): crc_of(i) for i in zin.infolist() if not i.is_dir()}
            stale = any(n in members and members[n] != bios_want[n] for n in bios_want)
            missing = any(n not in members for n in MANDATORY)
            if not stale and not missing:
                skipped.append(approved_id)
                continue
            tmp = target + ".tmp"
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    if item.is_dir() or is_junk(item.filename):
                        continue
                    if item.filename.lower() in drop_names:
                        continue
                    zout.writestr(item.filename, zin.read(item.filename))
                for name, payload in donor_bios.items():
                    zout.writestr(name, payload)
        # Verify the rebuilt zip carries the mandatory trio exactly.
        with zipfile.ZipFile(tmp) as zcheck:
            have = {i.filename.lower(): crc_of(i) for i in zcheck.infolist()}
        for name, crc in MANDATORY.items():
            assert have.get(name) == crc, f"{approved_id}: {name} still wrong after rebuild"
        os.replace(tmp, target)
        info["size"] = os.path.getsize(target)
        info["bios_repaired"] = True
        rebuilt.append(approved_id)

    with open(os.path.join(staging, "arcade-playable.json"), "w", encoding="utf-8") as fh:
        json.dump(arcade, fh, indent=2, sort_keys=True)
    print(json.dumps({"rebuilt": rebuilt, "already_current": skipped}, indent=2))


if __name__ == "__main__":
    main()
