// 🤖 Outrun the AI — a turn-based endless runner for the GitHub README.
// Hero BYTE runs through a world an "unpredictable AI" generates each turn.
//  - ground obstacle 👾  -> the player must JUMP
//  - air obstacle    🛸  -> the player must DUCK
//  - clear track         -> just RUN
// One opened issue "play|<jump|duck|run>" = one turn. The engine evaluates the
// move, lets the AI spawn the next obstacle, re-renders the scene and rewrites
// the section between the RUNNER markers in README.md.

const fs = require("fs");

const README = "README.md";
const STATE = "game/state.json";
const W = 11;
const H = 4;

// scene tiles (all full-width emoji so the grid stays aligned)
const SKY = "🟦";
const GROUND = "🟩";
const HERO = "🤖";
const BUG = "👾"; // ground obstacle  -> JUMP
const DRONE = "🛸"; // air obstacle    -> DUCK
const CLOUD = "☁️";
const BOOM = "💥";

const HERO_COL = 1;
const OBST_COL = W - 3;
const HERO_ROW = 2; // lane just above the ground row
const AIR_ROW = 1;

const TAUNTS = [
  "🧠 The AI is learning your moves...",
  "⚡ It just got faster!",
  "🔮 Unpredictable as ever.",
  "💾 New pattern generated.",
  "🤖 The AI did not expect that.",
  "🐛 More bugs incoming — correct them!",
];

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch (e) {
    return null;
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// the "unpredictable AI" that spawns the next obstacle
function aiNext(score) {
  const r = Math.random();
  // the further you go, the rarer the breathers
  const noneChance = Math.max(0.08, 0.28 - score * 0.01);
  if (r < noneChance) return "none";
  return Math.random() < 0.5 ? "ground" : "air";
}

function freshState(best = 0, lastPlayer = null) {
  return {
    hero: "BYTE",
    pose: "run",
    incoming: "ground", // every run opens with a jumpable bug 👾
    score: 0,
    best: best,
    distance: 0,
    alive: true,
    lastPlayer: lastPlayer,
    message: "🔁 New run! The AI is generating the world — go!",
  };
}

function applyMove(state, action) {
  // restart after a crash on any input
  if (!state.alive) {
    return freshState(state.best, state.lastPlayer);
  }

  const inc = state.incoming;
  const crashed =
    (inc === "ground" && action !== "jump") || (inc === "air" && action !== "duck");

  if (crashed) {
    state.alive = false;
    state.pose = "crash";
    state.best = Math.max(state.best || 0, state.score || 0);
    const what = inc === "ground" ? "bug 👾 (should have JUMPED)" : "drone 🛸 (should have DUCKED)";
    state.message = "💥 Crashed into the AI's " + what + "! Score: " + state.score + ". Tap any control to restart.";
    return state; // keep `incoming` so we can draw the crash
  }

  // survived this turn
  if (inc !== "none") state.score++;
  state.distance++;
  state.pose = action;
  state.incoming = aiNext(state.score);
  const ok = inc === "none" ? "🏃 Clear track!" : action === "jump" ? "🦘 Jumped a bug!" : "🦆 Ducked a drone!";
  state.message = ok + "  " + pick(TAUNTS);
  return state;
}

function render(state) {
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(y === H - 1 ? GROUND : SKY));

  // a couple of static clouds for scenery
  grid[0][2] = CLOUD;
  grid[0][7] = CLOUD;

  if (state.pose === "crash") {
    grid[HERO_ROW][HERO_COL] = BOOM;
    if (state.incoming === "ground") grid[HERO_ROW][HERO_COL + 1] = BUG;
    if (state.incoming === "air") grid[AIR_ROW][HERO_COL] = DRONE;
  } else {
    grid[HERO_ROW][HERO_COL] = HERO;
    if (state.incoming === "ground") grid[HERO_ROW][OBST_COL] = BUG;
    if (state.incoming === "air") grid[AIR_ROW][OBST_COL] = DRONE;
  }

  return grid.map((row) => row.join("")).join("\n");
}

function moveLink(action, label) {
  const repo = process.env.GITHUB_REPOSITORY || "goncalveses/goncalveses";
  const title = encodeURIComponent("play|" + action);
  const verb = action === "jump" ? "JUMP" : action === "duck" ? "DUCK" : "RUN";
  const body = encodeURIComponent(
    "Just press the green button below to " +
      verb +
      ".\nThe AI spawns the next obstacle and the README updates in ~30s. 🤖"
  );
  return "[" + label + "](https://github.com/" + repo + "/issues/new?title=" + title + "&body=" + body + ")";
}

function block(state) {
  const scene = render(state);
  return [
    "<!-- RUNNER:START -->",
    '<div align="center">',
    "",
    "**🤖 Outrun the AI**  ·  Score: **" + state.score + "**  ·  Best: **" + state.best + "**  ·  Distance: **" + state.distance + "**",
    "",
    "```",
    scene,
    "```",
    "",
    '<p align="center">' + moveLink("jump", "🦘 Jump") + " &nbsp;&nbsp;&nbsp; " + moveLink("duck", "🦆 Duck") + " &nbsp;&nbsp;&nbsp; " + moveLink("run", "🏃 Run") + "</p>",
    "",
    "_" + (state.message || "") + "_" + (state.lastPlayer ? "  ·  last move by **@" + state.lastPlayer + "**" : ""),
    "",
    "<sub>👾 ground = <b>Jump</b> &nbsp;·&nbsp; 🛸 air = <b>Duck</b> &nbsp;·&nbsp; clear = <b>Run</b>. Turn-based: click → press <b>Create</b> on the issue → the world updates in ~30s. 🤖</sub>",
    "</div>",
    "<!-- RUNNER:END -->",
  ].join("\n");
}

function main() {
  let state = loadState() || freshState();

  const title = process.env.ISSUE_TITLE || "";
  const actor = process.env.ISSUE_ACTOR || "";
  const m = title.match(/^play\|(jump|duck|run)/i);
  if (m) {
    if (actor) state.lastPlayer = actor;
    state = applyMove(state, m[1].toLowerCase());
  }

  fs.mkdirSync("game", { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

  let readme = fs.readFileSync(README, "utf8");
  const re = /<!-- RUNNER:START -->[\s\S]*<!-- RUNNER:END -->/;
  const newBlock = block(state);
  readme = re.test(readme) ? readme.replace(re, newBlock) : readme + "\n\n" + newBlock + "\n";
  fs.writeFileSync(README, readme);

  console.log("runner: score=" + state.score + " dist=" + state.distance + " incoming=" + state.incoming + " alive=" + state.alive);
}

main();
