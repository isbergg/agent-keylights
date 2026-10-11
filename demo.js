// Demo: keys 1-4 show each state; key 5 plays a full agent lifecycle.
// Usage: node D:/AgentBoard/demo.js   (agentlights must be running)
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "states");
fs.mkdirSync(dir, { recursive: true });

// Sorts before real sessions so demo keys land on 1-5.
const now = 0;
const write = (i, state) =>
  fs.writeFileSync(path.join(dir, `demo-${i}.json`),
    JSON.stringify({ state, created: now + i, updated: Date.now() }));

const legend = [
  ["idle", "blue        - idle, no task"],
  ["working", "yellow pulse - working"],
  ["attention", "red blink   - needs permission"],
  ["done", "green       - task done"],
];
legend.forEach(([s, label], i) => {
  write(i, s);
  console.log(`key ${i + 1}: ${label}`);
});

const story = [
  ["idle", "session opened", 3],
  ["working", "you sent a prompt, agent is working", 5],
  ["attention", "agent asks for permission", 5],
  ["working", "you approved, back to work", 4],
  ["done", "task finished", 4],
];
console.log("\nkey 5: agent lifecycle");

let step = 0;
const next = () => {
  if (step === story.length) {
    for (let i = 0; i < 5; i++) fs.unlinkSync(path.join(dir, `demo-${i}.json`));
    console.log("\nDemo finished, keys cleared.");
    return;
  }
  const [state, msg, secs] = story[step++];
  write(4, state);
  for (let i = 0; i < 4; i++) write(i, legend[i][0]); // keep fresh
  console.log(`  -> ${msg} (${state})`);
  setTimeout(next, secs * 1000);
};
next();

process.on("SIGINT", () => {
  for (let i = 0; i < 5; i++) { try { fs.unlinkSync(path.join(dir, `demo-${i}.json`)); } catch {} }
  process.exit();
});
