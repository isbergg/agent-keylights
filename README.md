# agent-keylights

See the status of your Claude Code agents on your RGB keyboard. Each session gets a number key:

| Key light | Meaning |
|---|---|
| 🔴 Blinking red | Needs permission / your attention |
| 🟡 Pulsing yellow | Working |
| 🟢 Green | Task done |
| 🔵 Blue | Idle, no task |

The first session lights key **1**, the second key **2**, up to **9**. Works with any keyboard supported by [OpenRGB](https://openrgb.org). Keyboards without per-key lighting show the most urgent state on the whole board.

## How it works

- `hook.js` is a Claude Code hook. It writes each session's state to `states/<session_id>.json`.
- `agentlights.py` reads those files and drives the keys through the OpenRGB SDK.
- `config.json` sets the colors, effects, keys and base color. It reloads live.

## Setup

1. Install [OpenRGB](https://openrgb.org), [Node.js](https://nodejs.org) and Python 3. Close your keyboard vendor's RGB software, because it conflicts with OpenRGB.
2. Install the Python library: `pip install openrgb-python`
3. Merge the contents of [`hooks.example.json`](hooks.example.json) into `~/.claude/settings.json`, replacing the path with where you cloned this repo.
4. Start OpenRGB with its SDK server, bound to localhost only:
   ```
   OpenRGB.exe --server --server-host 127.0.0.1 --startminimized
   ```
5. Run `python agentlights.py --list` to check your keyboard is detected, then `python agentlights.py`.
6. Optional: run `node demo.js` to cycle through every state.

### Autostart on Windows

Create `AgentBoard.vbs` in your Startup folder (`Win+R` → `shell:startup`):

```vbs
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Program Files\OpenRGB\OpenRGB.exe"" --server --server-host 127.0.0.1 --startminimized", 0, False
sh.Run "pyw ""C:\path\to\agent-keylights\agentlights.py""", 0, False
```

## Security notes

- Nothing leaves your machine. The hook writes only local files, and the controller talks only to OpenRGB on `127.0.0.1`.
- The OpenRGB SDK server has no authentication. Bind it to `127.0.0.1` (as shown above) so other devices on your network can't control your lights.
- `states/` contains session IDs and project paths and is git-ignored.

## License

MIT
