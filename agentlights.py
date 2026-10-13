"""AgentBoard: shows Claude Code agent status on RGB keyboard keys via OpenRGB.

Agent N (in order of session start) -> key N. Works with any keyboard OpenRGB
supports. Keyboards without per-key control show the most urgent state on
the whole board instead.
"""
import json
import math
import os
import sys
import time

from openrgb import OpenRGBClient
from openrgb.utils import DeviceType, RGBColor

ROOT = os.path.dirname(os.path.abspath(__file__))
STATES = os.path.join(ROOT, "states")
PRIORITY = ["attention", "error", "working", "done", "idle"]


def load_config():
    with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
        return json.load(f)


def read_sessions(stale_hours):
    sessions = []
    if not os.path.isdir(STATES):
        return sessions
    now = time.time() * 1000
    for name in os.listdir(STATES):
        if not name.endswith(".json"):
            continue
        path = os.path.join(STATES, name)
        try:
            with open(path, encoding="utf-8") as f:
                rec = json.load(f)
        except (OSError, ValueError):
            continue
        if now - rec.get("updated", 0) > stale_hours * 3600_000:
            try:
                os.remove(path)  # session crashed without SessionEnd
            except OSError:
                pass
            continue
        rec["id"] = name[:-5]
        sessions.append(rec)
    sessions.sort(key=lambda r: (r.get("group", r.get("created", 0)), r.get("created", 0)))
    return sessions


def scale(rgb, k):
    return RGBColor(*(int(c * k) for c in rgb))


def effect_color(spec, t):
    rgb, effect = spec["rgb"], spec.get("effect", "solid")
    if effect == "blink":
        return scale(rgb, 1.0 if int(t * 2.5) % 2 == 0 else 0.0)
    if effect == "pulse":
        return scale(rgb, 0.25 + 0.75 * (0.5 + 0.5 * math.sin(t * 3.0)))
    return scale(rgb, 1.0)


def find_key_leds(device, keys):
    """Map key label -> LED index, matching OpenRGB names like 'Key: 1'."""
    names = {led.name.lower(): i for i, led in enumerate(device.leds)}
    out = {}
    for k in keys:
        for cand in (f"key: {k}", f"key: {k}!", k):
            if cand.lower() in names:
                out[k] = names[cand.lower()]
                break
    return out


def connect(cfg):
    while True:
        try:
            return OpenRGBClient(cfg["host"], cfg["port"], "AgentBoard")
        except Exception as e:  # noqa: BLE001
            print(f"Waiting for OpenRGB SDK server ({e}); retrying in 5s...")
            time.sleep(5)


def setup_devices(client, keys):
    boards = [d for d in client.devices if d.type == DeviceType.KEYBOARD]
    if not boards:
        print("No keyboard found in OpenRGB. Is it detected in the OpenRGB app?")
    setup = []
    for d in boards:
        try:
            d.set_custom_mode()  # direct/per-LED mode
        except Exception as e:  # noqa: BLE001
            print(f"{d.name}: could not set custom mode ({e})")
        mapping = find_key_leds(d, keys)
        mode = "per-key" if mapping else "whole-board fallback"
        print(f"Using {d.name} ({len(d.leds)} LEDs, {mode})")
        setup.append((d, mapping))
    return setup


def clear_pre_boot_states():
    """Sessions recorded before this boot are dead (no SessionEnd fired)."""
    if not os.path.isdir(STATES):
        return
    import ctypes
    uptime = ctypes.windll.kernel32.GetTickCount64() / 1000 if os.name == "nt" else 0
    boot = time.time() - uptime
    for name in os.listdir(STATES):
        path = os.path.join(STATES, name)
        if uptime and os.path.getmtime(path) < boot:
            try:
                os.remove(path)
            except OSError:
                pass


def main():
    clear_pre_boot_states()
    cfg = load_config()
    client = connect(cfg)
    setup = setup_devices(client, cfg["keys"])
    base = RGBColor(*cfg["base_color"])
    frame = 1.0 / cfg.get("fps", 20)
    last = {}

    print("AgentBoard running. Ctrl+C to stop.")
    while True:
        try:
            cfg = load_config()  # live-reload colors
            t = time.time()
            sessions = read_sessions(cfg.get("stale_hours", 12))[: len(cfg["keys"])]
            colors = cfg["colors"]

            for d, mapping in setup:
                leds = [base] * len(d.leds)
                if mapping:
                    for key, rec in zip(cfg["keys"], sessions):
                        if key in mapping:
                            spec = colors.get(rec.get("state"), colors["idle"])
                            leds[mapping[key]] = effect_color(spec, t)
                elif sessions:
                    worst = min(sessions, key=lambda r: PRIORITY.index(r.get("state"))
                                if r.get("state") in PRIORITY else 99)
                    leds = [effect_color(colors.get(worst.get("state"), colors["idle"]), t)] * len(d.leds)

                sig = tuple((c.red, c.green, c.blue) for c in leds)
                if last.get(d.id) != sig:
                    d.set_colors(leds, fast=True)
                    last[d.id] = sig
            time.sleep(frame)
        except KeyboardInterrupt:
            print("Stopped.")
            return
        except (ConnectionError, OSError) as e:
            print(f"Lost connection to OpenRGB ({e}); reconnecting...")
            client = connect(cfg)
            setup = setup_devices(client, cfg["keys"])
            last.clear()


if __name__ == "__main__":
    if "--list" in sys.argv:
        c = OpenRGBClient(load_config()["host"], load_config()["port"], "AgentBoard")
        for d in c.devices:
            print(f"[{d.type.name}] {d.name}: {len(d.leds)} LEDs")
            print("   ", ", ".join(l.name for l in d.leds[:40]), "...")
    else:
        main()
