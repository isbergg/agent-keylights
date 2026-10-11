// Claude Code hook: records each session's state for the light daemon.
// Usage (from settings.json hooks): node D:/AgentBoard/hook.js <event>
const fs = require("fs");
const path = require("path");

const STATES = path.join(__dirname, "states");
const event = process.argv[2];

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data = {};
  try { data = JSON.parse(input.replace(/^﻿/, "")); } catch {}
  const id = (data.session_id || "unknown").replace(/[^\w-]/g, "");
  const file = path.join(STATES, id + ".json");
  fs.mkdirSync(STATES, { recursive: true });

  if (event === "SessionEnd") {
    try { fs.unlinkSync(file); } catch {}
    return;
  }

  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}

  let state;
  switch (event) {
    case "SessionStart": state = "idle"; break;
    case "UserPromptSubmit":
    case "PreToolUse":
    case "PostToolUse": state = "working"; break;
    case "Notification":
      // idle_prompt fires after the agent has already finished; keep "done".
      state = data.notification_type === "idle_prompt" ? (prev.state || "done") : "attention";
      break;
    case "Stop": state = "done"; break;
    case "Error": state = "error"; break;
    default: return;
  }

  const rec = {
    state,
    cwd: data.cwd || prev.cwd || "",
    created: prev.created || Date.now(),
    updated: Date.now(),
  };
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(rec));
  fs.renameSync(tmp, file);
});
