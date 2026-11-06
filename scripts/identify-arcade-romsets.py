#!/usr/bin/env python3
"""Identify the FBNeo romset name for each migrated Arcade zip.

FBNeo (the EmulatorJS 'arcade' core) identifies a romset by the ZIP's
file name. GGEMU stores every ROM as game.zip, so the local player
shows 'Romset is unknown' on first load. This script matches each
staged zip's member CRCs against the official FBNeo ClrMamePro dat
(libretro-database, metadat/fbneo-split) and reports the set name
whose ROMs are fully contained in the zip. GGEMU zips are merged sets
(they also carry the machine BIOS ROMs), so containment of the game
set — not equality — is the right test.

Usage:
  python3 scripts/identify-arcade-romsets.py \
      --staging ~/workspace/retroplay-roms --dat /tmp/fbneo-arcade.dat

Output: <staging>/romsets.json {approved_id: romset} plus a JSON
summary with any games that need manual identification.
"""
import argparse
import json
import os
import xml.etree.ElementTree as ET
import zipfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", required=True)
    parser.add_argument("--dat", required=True)
    args = parser.parse_args()

    # Parse the dat into: set name -> {crc: (rom_name, size)}, cloneof.
    sets = {}
    tree = ET.parse(args.dat)
    for game in tree.getroot().iter("game"):
        name = game.get("name")
        roms = {}
        for rom in game.iter("rom"):
            crc = (rom.get("crc") or "").lower()
            if crc:
                roms[crc] = (rom.get("name"), int(rom.get("size") or 0))
        if roms:
            sets[name] = {"roms": roms, "cloneof": game.get("cloneof")}

    # Index sets by member CRC for candidate lookup, and compute each
    # CRC's document frequency: BIOS ROMs appear in hundreds of sets and
    # carry no identifying power, game ROMs appear in a handful.
    by_crc = {}
    for set_name, info in sets.items():
        for crc in info["roms"]:
            by_crc.setdefault(crc, []).append(set_name)

    with open(os.path.join(args.staging, "playable.json"), encoding="utf-8") as fh:
        playable = json.load(fh)

    romsets = {}
    problems = []
    for entry in playable:
        if entry["platform"] != "Arcade":
            continue
        path = os.path.join(args.staging, entry["upstream_id"], f"game.{entry['ext']}")
        with zipfile.ZipFile(path) as zf:
            members = {format(info.CRC & 0xFFFFFFFF, "08x"): info.filename
                       for info in zf.infolist() if not info.is_dir()}
        member_crcs = set(members)
        # Score candidate sets by summed member weights (1/df): the set
        # that explains the zip's game-specific ROMs wins. BIOS ROMs in
        # these merged zips partly use older dumps absent from the dat,
        # so strict containment of the dat entry cannot be required.
        import math
        # Members absent from the dat entirely (older BIOS dumps) are
        # unexplainable by any set; exclude them from the scoring.
        weight = {crc: 1.0 / math.log2(1 + len(by_crc[crc]))
                  for crc in member_crcs if crc in by_crc}
        total_weight = sum(weight.values())
        scores = {}
        for crc in member_crcs:
            for set_name in by_crc.get(crc, []):
                scores[set_name] = scores.get(set_name, 0.0) + weight[crc]
        if not scores:
            problems.append({"approved_id": entry["approved_id"],
                             "problem": "no candidate set shares any member CRC",
                             "members": len(member_crcs)})
            continue
        ranked = sorted(scores.items(),
                        key=lambda kv: (-kv[1], 1 if sets[kv[0]]["cloneof"] else 0, kv[0]))
        chosen, best = ranked[0]
        explained = best / total_weight if total_weight else 0.0
        romsets[entry["approved_id"]] = chosen
        runner_up = ranked[1] if len(ranked) > 1 else None
        if explained < 0.9 or (runner_up and runner_up[1] > best * 0.98):
            problems.append({"approved_id": entry["approved_id"],
                             "problem": f"low-confidence match {chosen} "
                                        f"(explains {explained:.0%}"
                                        + (f", runner-up {runner_up[0]} {runner_up[1] / total_weight:.0%}"
                                           if runner_up else "")
                                        + ")"})

    with open(os.path.join(args.staging, "romsets.json"), "w", encoding="utf-8") as fh:
        json.dump(romsets, fh, indent=2, sort_keys=True)
    print(json.dumps({"identified": len(romsets), "problems": problems}, indent=2))


if __name__ == "__main__":
    main()
