export interface AgentSession {
  agent: string;
  value: string;
}

export interface Pane {
  pane_id: string;
  tab_id: string;
  label?: string | null;
  cwd?: string | null;
  foreground_cwd?: string | null;
  agent?: string | null;
  title?: string | null;
  terminal_title_stripped?: string | null;
  agent_session?: AgentSession | null;
  focused: boolean;
}

export interface Tab {
  tab_id: string;
  label: string;
  pane_count: number;
}

export interface Snapshot {
  panes: Pane[];
  tabs: Tab[];
  focused_pane_id: string | null;
}
