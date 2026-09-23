import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface SuperpowersSkill {
  id: string;
  name: string;
  description?: string;
  location: string;
  path: string;
  content: string;
  source: { type: "directory"; path: string };
}

function frontmatter(content: string): { attributes: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { attributes: {}, body: content };

  const attributes: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    attributes[key] = value.replace(/^(["'])(.*)\1$/, "$2");
  }
  return { attributes, body: match[2] ?? "" };
}

export function loadSkills(skillsDirectory: string): SuperpowersSkill[] {
  if (!existsSync(skillsDirectory)) return [];
  return readdirSync(skillsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const location = join(skillsDirectory, entry.name, "SKILL.md");
      if (!existsSync(location)) return [];
      const { attributes, body } = frontmatter(readFileSync(location, "utf8"));
      const id = attributes.name ?? entry.name;
      return [{ id, name: id, description: attributes.description, location, path: location, source: { type: "directory" as const, path: location }, content: body }];
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function bootstrap(skillsDirectory: string): string | undefined {
  const location = join(skillsDirectory, "using-superpowers", "SKILL.md");
  if (!existsSync(location)) return undefined;
  const { body } = frontmatter(readFileSync(location, "utf8"));
  return `<EXTREMELY_IMPORTANT>
You have superpowers.

**IMPORTANT: The using-superpowers skill content is included below. It is ALREADY LOADED - you are currently following it. Do NOT use the skill tool to load "using-superpowers" again - that would be redundant.**

${body}

**Tool Mapping for OpenCode:**
- Create or update todos → \`todowrite\`
- Dispatch a subagent → \`subagent\` (use \`general\` or \`explore\` as appropriate)
- Invoke a skill → \`skill\`
- Read files → \`read\`
- Create, edit, or delete files → \`patch\`
- Run shell commands → \`shell\`
- Search files → \`grep\`, \`glob\`
- Fetch a URL → \`webfetch\`

Use OpenCode's native \`skill\` tool to list and load skills.
</EXTREMELY_IMPORTANT>`;
}

export function injectBootstrap(system: Array<{ type: string; text?: string }>, content: string): void {
  if (system.some((part) => part.type === "text" && part.text?.includes("<EXTREMELY_IMPORTANT>"))) return;
  system.unshift({ type: "text", text: content });
}

export function upstreamSkillsDirectory(packageDirectory: string): string {
  return resolve(packageDirectory, "node_modules", "superpowers", "skills");
}
