export const GH_USER = "codezeroexe";

export const repoUrl = (repo: string) => `https://github.com/${GH_USER}/${repo}`;

export type Project = {
  /** printed on the panel */
  name: string;
  /** the GitHub slug — this is what the live fetch matches on */
  repo: string;
  description: string;
  topics: string[];
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
    name: "Zetavote",
    repo: "zetavote",
    description:
      "Local-first voting with cryptographic voter authentication, encrypted ballots, tamper-evident audits and receipt-based verification. Runs on-device.",
    topics: ["TypeScript", "SQLite", "FastAPI", "Local-first"],
    pushed_at: "2026-09-29",
  },
  {
    name: "Yggdrasil",
    repo: "yggdrasil-prototype",
    description:
      "Interactive prototype for a team-based CTF challenge: task workspaces, downloadable artifacts, progress tracking and flag validation.",
    topics: ["TypeScript", "CTF", "Web app"],
    pushed_at: "2026-08-26",
  },
  {
    name: "SQLShield",
    repo: "sqlshield-demo",
    description:
      "Shows how parameterized queries prevent SQL injection, with the unsafe string-concatenation version sitting right beside it.",
    topics: ["JavaScript", "Security", "SQL"],
    pushed_at: "2026-09-24",
  },
  {
    name: "Fraud Detector v3",
    repo: "neural-fraud-detector-v3",
    description:
      "Third pass at the credit-card fraud detector: a stacked ensemble of three models to lift precision.",
    topics: ["Ensemble", "Fraud detection", "Deep learning"],
    pushed_at: "2026-04-23",
  },
];