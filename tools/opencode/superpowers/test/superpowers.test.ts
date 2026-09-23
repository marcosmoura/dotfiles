import { expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrap, injectBootstrap, loadSkills } from "../src/superpowers.js";

function fixture(): string {
  const directory = join(import.meta.dir, ".fixtures", crypto.randomUUID());
  mkdirSync(join(directory, "using-superpowers"), { recursive: true });
  mkdirSync(join(directory, "brainstorming"));
  writeFileSync(join(directory, "using-superpowers", "SKILL.md"), "---\nname: using-superpowers\n---\nBootstrap body\n");
  writeFileSync(join(directory, "brainstorming", "SKILL.md"), "---\nname: brainstorming\ndescription: \"Refine a design\"\n---\nSkill body\n");
  return directory;
}

test("loads upstream skills with frontmatter removed", () => {
  const directory = fixture();
  try {
    const loaded = loadSkills(directory);
    expect(loaded).toEqual([
      expect.objectContaining({ id: "brainstorming", description: "Refine a design", content: "Skill body\n" }),
      expect.objectContaining({ id: "using-superpowers", content: "Bootstrap body\n" }),
    ]);
    for (const item of loaded) {
      expect(item.path).toBe(item.location);
      expect(item.source).toEqual({ type: "directory", path: item.location });
    }
  } finally { rmSync(join(directory, ".."), { recursive: true, force: true }); }
});

test("injects the bootstrap only once", () => {
  const directory = fixture();
  try {
    const content = bootstrap(directory)!;
    const system: Array<{ type: string; text?: string }> = [{ type: "text", text: "Existing instructions" }];
    injectBootstrap(system, content);
    injectBootstrap(system, content);
    expect(system).toHaveLength(2);
    expect(system[0]?.text).toContain("<EXTREMELY_IMPORTANT>");
  } finally { rmSync(join(directory, ".."), { recursive: true, force: true }); }
});
