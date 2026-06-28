// 🐍 README Snake — turn-based engine driven by GitHub Issues + Actions.
// One opened issue titled "snake|<dir>" = one step. The engine moves the snake,
// re-renders the board, and rewrites the section between the SNAKE markers in README.md.

const fs = require("fs");

const README = "README.md";
const STATE = "game/state.json";
const W = 13;
const H = 11;

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: "down", down: "up", left: "right", right: "left" };

const EMPTY = "⬛";
const HEAD = "🟩";
const BODY = "🟢";
const FOOD = "🍎";

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch (e) {
    return null;
  }
}

function newFood(state) {
  const taken = new Set(state.snake.map((p) => p[0] + "," + p[1]));
  const free = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!taken.has(x + "," + y)) free.push([x, y]);
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

function freshState(best = 0, lastPlayer = null) {
  const s = {
    width: W,
    height: H,
    snake: [[Math.floor(W / 2), Math.floor(H / 2)]],
    dir: "up",
    food: null,
    score: 0,
    best: best,
    moves: 0,
    lastPlayer: lastPlayer,
    message: "New game! Tap an arrow below to move. 🐍",
  };
  s.food = newFood(s);
  return s;
}

function gameOver(state) {
  const best = Math.max(state.best || 0, state.score || 0);
  const ns = freshState(best, state.lastPlayer);
  ns.message = "💀 Game over! Score was " + state.score + ". A new game just started.";
  return ns;
}

function step(state, dir) {
  if (!DIRS[dir]) return state;
  // prevent instant 180° reversal
  if (state.snake.length > 1 && OPP[state.dir] === dir) dir = state.dir;
  state.dir = dir;

  const [dx, dy] = DIRS[dir];
  const head = state.snake[0];
  const nx = head[0] + dx;
  const ny = head[1] + dy;

  // wall collision
  if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) {
    return gameOver(state);
  }

  const willGrow = state.food && nx === state.food[0] && ny === state.food[1];
  const body = willGrow ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => p[0] === nx && p[1] === ny)) {
    return gameOver(state);
  }

  state.snake.unshift([nx, ny]);
  if (willGrow) {
    state.score++;
    if (state.score > state.best) state.best = state.score;
    state.food = newFood(state);
    state.message = "🍎 Yum! +1 point";
  } else {
    state.snake.pop();
    state.message = "Keep going! 🐍";
  }
  state.moves++;
  return state;
}

function render(state) {
  const grid = [];
  for (let y = 0; y < state.height; y++) grid.push(new Array(state.width).fill(EMPTY));
  if (state.food) grid[state.food[1]][state.food[0]] = FOOD;
  state.snake.forEach((p, i) => {
    grid[p[1]][p[0]] = i === 0 ? HEAD : BODY;
  });
  return grid.map((row) => row.join("")).join("\n");
}

function moveLink(dir, label) {
  const repo = process.env.GITHUB_REPOSITORY || "goncalveses/goncalveses";
  const title = encodeURIComponent("snake|" + dir);
  const body = encodeURIComponent(
    "Just press the green button below to move the snake " +
      dir.toUpperCase() +
      ".\nA bot applies your move and updates the README in ~30s. 🐍🤖"
  );
  return "[" + label + "](https://github.com/" + repo + "/issues/new?title=" + title + "&body=" + body + ")";
}

function block(state) {
  const board = render(state);
  return [
    "<!-- SNAKE:START -->",
    "<div align=\"center\">",
    "",
    "**🐍 Snake**  ·  Score: **" + state.score + "**  ·  Best: **" + state.best + "**",
    "",
    "```",
    board,
    "```",
    "",
    "<p align=\"center\">" + moveLink("up", "⬆️ Up") + "</p>",
    "<p align=\"center\">" +
      moveLink("left", "⬅️ Left") +
      " &nbsp;&nbsp;&nbsp; " +
      moveLink("down", "⬇️ Down") +
      " &nbsp;&nbsp;&nbsp; " +
      moveLink("right", "➡️ Right") +
      "</p>",
    "",
    "_" + (state.message || "") + "_" + (state.lastPlayer ? "  ·  last move by **@" + state.lastPlayer + "**" : ""),
    "",
    "<sub>Turn-based: click an arrow → press <b>Create</b> on the issue → the snake moves in ~30s. 🤖</sub>",
    "</div>",
    "<!-- SNAKE:END -->",
  ].join("\n");
}

function main() {
  let state = loadState() || freshState();

  const title = process.env.ISSUE_TITLE || "";
  const actor = process.env.ISSUE_ACTOR || "";
  const m = title.match(/^snake\|(up|down|left|right)/i);
  if (m) {
    if (actor) state.lastPlayer = actor;
    state = step(state, m[1].toLowerCase());
  }

  fs.mkdirSync("game", { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

  let readme = fs.readFileSync(README, "utf8");
  const re = /<!-- SNAKE:START -->[\s\S]*<!-- SNAKE:END -->/;
  const newBlock = block(state);
  readme = re.test(readme) ? readme.replace(re, newBlock) : readme + "\n\n" + newBlock + "\n";
  fs.writeFileSync(README, readme);

  console.log("snake: score=" + state.score + " moves=" + state.moves + " len=" + state.snake.length);
}

main();
