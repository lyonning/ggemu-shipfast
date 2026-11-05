#!/usr/bin/env python3
"""Phase 2 ROM normalization: produce the *playable* file per game.

GGEMU sometimes serves an archive under a raw-ROM filename (e.g. a ZIP
named game.nds, or a ZIP named game.smc). EmulatorJS decides how to load
a file from its extension, so those would fail in our own player. This
script sniffs every staged file's magic bytes and, for non-Arcade
archives, extracts the single inner ROM as game.{inner_ext}.

Arcade sets stay zipped (fbneo/mame cores require the set as-is).

Run with the py7zr venv python so .7z archives work:
  ~/workspace/tools/py7zr-venv/bin/python scripts/normalize-roms.py \
      --staging ~/workspace/retroplay-roms

Output: <staging>/playable.json with one entry per fetched game.
"""
import argparse
import json
import os
import zipfile

import py7zr


def sniff(path):
    with open(path, "rb") as fh:
        head = fh.read(8)
    if head[:2] == b"PK":
        return "zip"
    if head[:6] == b"7z\xbc\xaf'\x1c":
        return "7z"
    return "raw"


def zip_members(path):
    with zipfile.ZipFile(path) as zf:
        return [(i.filename, i.file_size) for i in zf.infolist() if not i.is_dir()]


def zip_extract(path, member, target):
    with zipfile.ZipFile(path) as zf:
        with zf.open(member) as src, open(target, "wb") as dst:
            while chunk := src.read(1 << 20):
                dst.write(chunk)


def seven_zip_members(path):
    with py7zr.SevenZipFile(path, "r") as archive:
        return [(name, info.uncompressed) for name, info in
                ((n, archive.getinfo(n)) for n in archive.getnames())
                if not info.is_directory]


def seven_zip_extract(path, member, target_dir):
    with py7zr.SevenZipFile(path, "r") as archive:
        archive.extract(path=target_dir, targets=[member])
    return os.path.join(target_dir, member)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", required=True)
    args = parser.parse_args()
    staging = args.staging

    with open(os.path.join(staging, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)

    playable = []
    anomalies = []
    for entry in manifest:
        if not (entry["status"].startswith("downloaded")
                or entry["status"] == "already_present"):
            continue
        game_dir = os.path.join(staging, entry["upstream_id"])
        src = os.path.join(game_dir, f"game.{entry['ext']}")
        kind = sniff(src)
        base = {
            "approved_id": entry["approved_id"],
            "upstream_id": entry["upstream_id"],
            "platform": entry["platform"],
        }
        if kind == "raw":
            playable.append({**base, "ext": entry["ext"],
                             "size": os.path.getsize(src), "source": "raw"})
            continue
        if entry["platform"] == "Arcade":
            playable.append({**base, "ext": entry["ext"],
                             "size": os.path.getsize(src), "source": "arcade-zip"})
            continue
        # Non-Arcade archive: extract the largest member as the ROM.
        # Unwrap repeatedly (some files are archives nested in archives),
        # extracting via a temp path because the inner file often carries
        # the same extension as the archive itself (game.nds in game.nds).
        current, current_kind, member = src, kind, None
        for _round in range(3):
            members = (zip_members(current) if current_kind == "zip"
                       else seven_zip_members(current))
            members = [(n, s) for n, s in members if s and s > 1024]
            if not members:
                member = None
                break
            member, _size = max(members, key=lambda item: item[1])
            inner_ext = os.path.splitext(member)[1].lstrip(".").lower()
            tmp = os.path.join(game_dir, f"game.unwrap.{inner_ext}")
            if current_kind == "zip":
                zip_extract(current, member, tmp)
            else:
                extracted = seven_zip_extract(current, member, game_dir)
                os.replace(extracted, tmp)
            if current != src:
                os.remove(current)
            current = tmp
            current_kind = sniff(current)
            if current_kind == "raw":
                break
        if member is None:
            anomalies.append({**base, "problem": "archive has no sizable member"})
            continue
        if current_kind != "raw":
            anomalies.append({**base, "problem": f"inner file {member} is itself an archive"})
            continue
        inner_ext = os.path.splitext(member)[1].lstrip(".").lower()
        target = os.path.join(game_dir, f"game.{inner_ext}")
        if os.path.abspath(current) != os.path.abspath(target):
            os.replace(current, target)
        playable.append({**base, "ext": inner_ext,
                         "size": os.path.getsize(target),
                         "source": f"{kind}-inner", "inner_name": member})

    with open(os.path.join(staging, "playable.json"), "w", encoding="utf-8") as fh:
        json.dump(playable, fh, indent=2)
    print(json.dumps({
        "playable": len(playable),
        "extracted": sum(1 for p in playable if p["source"].endswith("-inner")),
        "anomalies": anomalies,
    }))


if __name__ == "__main__":
    main()
