use zellij_tile::prelude::*;

pub struct Frames;

impl Frames {
    pub fn hide_frames_conditionally(
        pane_info: &PaneManifest,
        tabs: &[TabInfo],
        mode_info: &ModeInfo,
        plugin_pane_id: PluginIds,
    ) {
        let panes = match Self::get_current_panes(tabs, pane_info) {
            Some(panes) => panes,
            None => return,
        };

        // check if we are running for the current tab since one plugin will run for
        // each tab. If we do not prevent execution, the screen will start to flicker
        // 'cause every plugin will try to toggle the frames.
        if !Self::is_plugin_for_current_tab(&panes, plugin_pane_id) {
            return;
        }

        let panes: Vec<&PaneInfo> = panes
            .iter()
            .filter(|p| !p.is_plugin && !p.is_floating)
            .collect();

        let frame_enabled = panes
            .iter()
            .filter(|&&p| !p.is_suppressed)
            .any(|p| p.pane_content_x - p.pane_x > 0);

        let display_frames = Self::should_show_frames(mode_info, &panes);

        if display_frames && !frame_enabled {
            toggle_pane_frames();
        }

        if !display_frames && frame_enabled {
            toggle_pane_frames();
        }
    }

    fn should_show_frames(mode_info: &ModeInfo, panes: &[&PaneInfo]) -> bool {
        let mode = mode_info.mode;

        if mode == InputMode::RenamePane
            || mode == InputMode::Search
            || mode == InputMode::EnterSearch
        {
            return true;
        }

        panes.len() > 1
    }

    fn is_plugin_for_current_tab(panes: &[PaneInfo], plugin_pane_id: PluginIds) -> bool {
        panes
            .iter()
            .any(|p| p.is_plugin && p.id == plugin_pane_id.plugin_id)
    }

    fn get_current_panes(tabs: &[TabInfo], pane_info: &PaneManifest) -> Option<Vec<PaneInfo>> {
        let active_tab = tabs.iter().find(|t| t.active);
        let active_tab = active_tab.as_ref()?;

        pane_info.panes.get(&active_tab.position).cloned()
    }
}
