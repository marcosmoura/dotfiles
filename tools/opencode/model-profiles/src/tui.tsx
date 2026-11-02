import { readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { Plugin } from "@opencode/plugin/tui";
import { applyPlan, readConfigState } from "./config.js";
import {
  loadProfiles as loadMergedProfiles,
  planSwitch,
  profileColor,
  resolveProfiles,
  type ConfigState,
  type Profiles,
  type Resolution,
} from "./profiles.js";

interface State {
  active: Record<string, string>;
  snapshots: Record<string, ConfigState>;
}

export default Plugin.define({
  id: "opencode.model-profiles.tui",
  setup(context) {
    const [state, updateState] = context.storage.store("state", {
      initial: { active: {}, snapshots: {} } as State,
    });

    const location = () => context.location ?? context.data.location.default();
    const resolve = (): Resolution => resolveProfiles(location().directory, homedir());

    const readProfilesFile = (path: string): string | undefined => {
      try {
        return readFileSync(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw new Error(`cannot read ${path}: ${error instanceof Error ? error.message : error}`);
      }
    };

    const loadProfiles = (res: Resolution): Profiles => loadMergedProfiles(res, readProfilesFile);

    // The sidebar renders often; re-read the profiles only when a file changes.
    let colorCache: { key: string; profiles: Profiles } | undefined;
    const sidebarProfiles = (res: Resolution): Profiles => {
      const mtime = (path: string) => statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? -1;
      const key = [res.profilesPath, mtime(res.profilesPath)]
        .concat(res.local ? [res.globalProfilesPath, mtime(res.globalProfilesPath)] : [])
        .join("|");
      if (colorCache?.key !== key) colorCache = { key, profiles: loadProfiles(res) };
      return colorCache.profiles;
    };

    const readConfig = (res: Resolution): string => {
      try {
        return readFileSync(res.configPath, "utf8");
      } catch {
        return "";
      }
    };

    const parseModelRef = (ref: string): { providerID: string; id: string; variant?: string } => {
      const [base, variant] = ref.split("#");
      const [providerID, id] = base!.split("/");
      return { providerID: providerID!, id: id!, ...(variant ? { variant } : {}) };
    };

    // The config only affects model *resolution*; an existing session keeps its
    // own pinned model, so push the profile's model for the session's agent.
    const syncSessionModel = async (configState: ConfigState): Promise<void> => {
      const route = context.ui.router.current();
      if (route.type !== "session") return;
      const session = context.data.session.get(route.sessionID);
      if (!session) return;

      const agentModel = session.agent ? configState.agents?.[session.agent]?.model : undefined;
      const ref = typeof agentModel === "string" ? agentModel : configState.model;
      if (!ref) return;
      await context.client.session.switchModel({
        sessionID: route.sessionID,
        model: parseModelRef(ref),
      });
    };

    const switchProfile = async (name: string): Promise<void> => {
      try {
        const res = resolve();
        const profiles = loadProfiles(res);
        const text = readConfig(res);
        const current = readConfigState(text);
        const existing = state.snapshots[res.configPath];
        // Capture the pre-switch baseline exactly once, before the first switch away.
        const snapshot = name !== "default" && !existing ? current : existing;

        const plan = planSwitch(name, profiles, current, existing);
        const updated = applyPlan(text, plan);
        if (updated !== text) writeFileSync(res.configPath, updated);

        updateState((draft) => {
          if (snapshot) draft.snapshots[res.configPath] = snapshot;
          draft.active[res.configPath] = name;
        });

        try {
          await syncSessionModel(readConfigState(updated));
        } catch (error) {
          context.ui.toast.show({
            message: `Profile ${name} saved, but the session model could not be updated: ${
              error instanceof Error ? error.message : String(error)
            }`,
            variant: "error",
          });
        }
        context.ui.toast.show({ message: `Model profile enabled: ${name}`, variant: "success" });
      } catch (error) {
        context.ui.toast.show({
          message: error instanceof Error ? error.message : String(error),
          variant: "error",
        });
      }
    };

    const pickProfile = async (): Promise<void> => {
      try {
        const res = resolve();
        const profiles = loadProfiles(res);
        const selected = await context.ui.dialog.select({
          title: "Model profile",
          current: state.active[res.configPath] ?? "default",
          options: [
            {
              title: "default",
              value: "default",
              description: "Default models from configuration",
            },
            ...Object.entries(profiles).map(([name, profile]) => ({
              title: name,
              value: name,
              ...(profile.description !== undefined ? { description: profile.description } : {}),
            })),
          ],
        });
        if (selected !== undefined) await switchProfile(selected);
      } catch (error) {
        context.ui.toast.show({
          message: error instanceof Error ? error.message : String(error),
          variant: "error",
        });
      }
    };

    // keymap.layer() resolves the TUI's Keymap provider at call time, but
    // setup() runs outside the component tree, so calling it directly throws
    // "Keymap.Provider is missing". The always-mounted "app" slot gives the
    // layer a Solid owner; the registration unwinds with the slot's unmount.
    const unregisterApp = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          priority: 10,
          commands: [
            {
              id: "model-profiles.switch",
              title: "Switch model profile",
              group: "Model",
              slash: { name: "profile", arguments: true },
              enabled: () => true,
              suggested: true,
              run: async (input: string | undefined) => {
                const name = input?.trim();
                if (!name) return pickProfile();
                await switchProfile(name);
              },
            },
          ],
          bindings: [],
        }));
        return null;
      },
    });

    const unregisterSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => {
        let name = "default";
        let color: string | undefined;
        try {
          const res = resolve();
          name = state.active[res.configPath] ?? "default";
          color = profileColor(name, sidebarProfiles(res));
        } catch {
          // Missing, unreadable or invalid profiles: render the name uncolored.
        }
        return (
          <text fg={context.theme.text.base}>
            Model Profile: <span style={{ fg: color ?? context.theme.text.base }}>{name}</span>
          </text>
        );
      },
    });

    return () => {
      unregisterApp();
      unregisterSidebar();
    };
  },
});
