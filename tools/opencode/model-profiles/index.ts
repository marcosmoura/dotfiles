// No-op server entry. Exporting "./tui" beside this file is what makes
// OpenCode load the terminal plugin; this entry only satisfies the package
// shape so a single line in `plugins` loads both halves.
const plugin = {
  id: "opencode.model-profiles",
  setup() {},
};

export default plugin;
