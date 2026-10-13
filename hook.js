// Claude Code hook: records each session's (and sub-agent's) state for the light daemon.
// Usage (from settings.json hooks): node <repo>/hook.js <event>
const fs = require("fs");
const path = require("path");

const STATES = path.join(__dirname, "states");
const event = process.argv[2];
const safe = (s) => String(s || "").replace(/[^\w-]/g, "");

const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
};
const writeJson = (file, rec) => {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(rec));
  fs.renameSync(tmp, file);
};
const remove = (file) => { try { fs.unlinkSync(file); } catch {} };

// Removes sub-agent files of a session; `onlyFinished` keeps running ones.
const clearAgents = (sid, onlyFinished) => {
  for (const name of fs.readdirSync(STATES)) {
    if (!name.startsWith(sid + "__") || !name.endsWith(".json")) continue;
    const file = path.join(STATES, name);
    if (!onlyFinished || readJson(file).state === "done") remove(file);
  }
};

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data = {};
  try { data = JSON.parse(input.replace(/^﻿/, "")); } catch {}
  const sid = safe(data.session_id) || "unknown";
  const aid = safe(data.agent_id);
  fs.mkdirSync(STATES, { recursive: true });

  const sessionFile = path.join(STATES, sid + ".json");
  if (event === "SessionEnd") {
    remove(sessionFile);
    clearAgents(sid, false);
    return;
  }

  // Events fired inside a sub-agent update that agent's own key.
  const file = aid ? path.join(STATES, `${sid}__${aid}.json`) : sessionFile;
  const prev = readJson(file);

  let state;
  switch (event) {
    case "SessionStart": state = "idle"; break;
    case "UserPromptSubmit":
      clearAgents(sid, true); // new prompt: drop finished sub-agent keys
      state = "working";
      break;
    case "SubagentStart":
    case "PreToolUse":
    case "PostToolUse": state = "working"; break;
    case "PermissionRequest": state = "attention"; break;
    case "Notification":
      // idle_prompt fires after the agent has already finished; keep "done".
      state = data.notification_type === "idle_prompt" ? (prev.state || "done") : "attention";
      break;
    case "SubagentStop":
    case "Stop": state = "done"; break;
    case "StopFailure": state = "error"; break;
    default: return;
  }

  const rec = {
    state,
    cwd: data.cwd || prev.cwd || "",
    created: prev.created || Date.now(),
    updated: Date.now(),
  };
  if (aid) {
    // Sort sub-agents right after their parent session.
    rec.parent = sid;
    rec.group = readJson(sessionFile).created || rec.created;
  } else {
    rec.group = rec.created;
  }
  writeJson(file, rec);
});
