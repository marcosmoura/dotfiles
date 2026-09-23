import type { Plugin, Skill } from "@opencode/plugin";
import { resolve } from "node:path";
import { bootstrap, injectBootstrap, loadSkills, upstreamSkillsDirectory } from "./superpowers.js";

const skillsDirectory = upstreamSkillsDirectory(resolve(import.meta.dirname, ".."));
const skills = loadSkills(skillsDirectory);
const bootstrapContent = bootstrap(skillsDirectory);

const plugin = {
  id: "opencode.superpowers",
  async setup(context) {
    await context.skill.transform((editor) => {
      for (const skill of skills) {
        if (editor.get(skill.id)) continue;
        editor.add(skill as unknown as Skill.Info);
      }
    });
    if (!bootstrapContent) return;
    await context.session.hook("context", (event) => injectBootstrap(event.system, bootstrapContent));
  },
} satisfies Plugin.Plugin;

export default plugin;
