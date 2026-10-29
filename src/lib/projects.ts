export const GH_USER = "codezeroexe";

export const repoUrl = (repo: string) => `https://github.com/${GH_USER}/${repo}`;

export type Project = {
  /** printed on the panel */
  name: string;
  /** the GitHub slug — this is what the live fetch matches on */
  repo: string;
  description: string;
  /** true keeps the text here instead of the shorter GitHub About line */
  keepDescription?: boolean;
  topics: string[];
  /** empty when unknown: the stamp is left off until the live fetch fills it */
  pushed_at: string;
};

/**
 * The four the sheet shows. Live data only refreshes the description and the
 * push date — pushing a homework repo must not replace the work.
 *
 * Nothing on this account carries GitHub topics, so `topics` here are written
 * by hand rather than read. Nothing is invented: every one is a real language
 * or a real thing the repo actually does.
 */
export const projects: Project[] = [
  {
    name: "Ultron",
    repo: "ultron",
    description:
      "A voice assistant that lives on your Mac and sends a legion of AI units to do the work. Local voice, Claude units, asks before anything risky.",
    topics: ["Swift", "Python", "MLX", "Claude Code"],
    pushed_at: "",
  },
  {
    name: "Rabbithole",
    repo: "rabbithole",
    description:
      "A graph explorer for deep dives. Type a topic and it lays out where to go next as cards, one column per level of depth. Open, add or dismiss nodes, and each one you open gets a short research note. Free on Wikipedia, or plug in Anthropic, OpenAI, Gemini, OpenRouter, Ollama or LM Studio.",
    keepDescription: true,
    topics: ["TypeScript", "Electron", "Local + hosted AI"],
    pushed_at: "",
  },
  {
    name: "Levels",
    repo: "levels",
    description:
      "Claude Code skills that rate parts of a project on a 1 to 5 scale, propose options, and hand the chosen work to cheaper models behind a confirmation gate.",
    topics: ["Claude Code", "Agent skills", "Plugin"],
    pushed_at: "",
  },
  {
    name: "Zetavote",
    repo: "zetavote",
    description:
      "Local-first voting with cryptographic voter authentication, encrypted ballots, tamper-evident audits and receipt-based verification. Runs on-device.",
    topics: ["TypeScript", "SQLite", "FastAPI", "Local-first"],
    pushed_at: "2026-09-29",
  },
];
