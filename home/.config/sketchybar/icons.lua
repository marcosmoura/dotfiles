local function glyph(hex_codepoint)
  return utf8.char(tonumber(hex_codepoint, 16))
end

return {
  fallback = {
    default = glyph("F18CB"), -- dashboard-circle
  },

  status = {
    clock = glyph("F24FA"),     -- time-03
    cpu = glyph("F186D"),       -- cpu
    cpu_hot = glyph("F186B"),   -- cpu-charge
    keepawake = glyph("F17EE"), -- coffee-02
  },

  battery = {
    charging = glyph("F14F6"),    -- battery-charging-01
    full = glyph("F14FA"),        -- battery-full
    medium_high = glyph("F14FD"), -- battery-medium-02
    medium = glyph("F14FC"),      -- battery-medium-01
    low = glyph("F14FB"),         -- battery-low
    empty = glyph("F14F9"),       -- battery-empty
  },

  battery_popup = {
    health = glyph("F1BA1"),      -- health
    cycles = glyph("F2149"),      -- refresh
    temperature = glyph("F248F"), -- temperature
    time = glyph("F24F9"),        -- time-02
  },

  weather = {
    snow = glyph("F2304"),                -- snow
    snowShowersDay = glyph("F240B"),      -- sun-cloud-snow-01
    snowShowersNight = glyph("F1EC7"),    -- moon-cloud-snow
    thunder = glyph("F17CE"),             -- cloud-angled-rain-zap
    thunderShowersDay = glyph("F17CE"),   -- cloud-angled-rain-zap
    thunderShowersNight = glyph("F1EBC"), -- moon-angled-rain-zap
    rain = glyph("F17CF"),                -- cloud-angled-rain
    rainDay = glyph("F23F5"),             -- sun-cloud-angled-rain-01
    rainNight = glyph("F1EBD"),           -- moon-cloud-angled-rain
    fog = glyph("F17DE"),                 -- cloud-slow-wind
    windy = glyph("F1A09"),               -- fast-wind
    cloudy = glyph("F17E2"),              -- cloud
    partlyCloudyDay = glyph("F23F4"),     -- sun-cloud-02
    partlyCloudyNight = glyph("F1EC8"),   -- moon-cloud
    clearDay = glyph("F23F0"),            -- sun-01
    clearNight = glyph("F1ECD"),          -- moon
    default = glyph("F23F0"),             -- clearDay
  },

  weather_popup = {
    temperature = glyph("F248F"), -- temperature
    humidity = glyph("F1C00"),    -- humidity
    wind = glyph("F1A09"),        -- fast-wind
  },

  media = {
    default = glyph("F205C"), -- play-circle-02
    spotify = glyph("F2348"), -- spotify
    edge = glyph("F26EC"),    -- youtube
    tidal = glyph("F2641"),   -- vynil-02
    feishin = glyph("F2641"), -- vynil-02
  },

  workspace = {
    terminal = glyph("F2332"),      -- source-code-square (closest fallback for missing computer-terminal-01)
    coding = glyph("F17E8"),        -- code-simple
    browser = glyph("F1373"),       -- ai-browser
    music = glyph("F1F29"),         -- music-note-03
    design = glyph("F1A15"),        -- figma
    communication = glyph("F1E47"), -- message-multiple-01
    guitar = glyph("F2641"),        -- vynil-02
    misc = glyph("F18CB"),          -- dashboard-circle
    files = glyph("F1AAD"),         -- folder-01
    mail = glyph("F1DA3"),          -- mail-01
    tasks = glyph("F1743"),         -- check-list
  },

  app = {
    ["Ableton Live"] = glyph("F1F28"),          -- music-note-02
    ["Activity Monitor"] = glyph("F1403"),      -- analytics-01
    ["App Store"] = glyph("F1415"),             -- app-store
    ["Archetype Gojira X"] = glyph("F1F28"),    -- music-note-02
    ["Archetype John Mayer X"] = glyph("F1F28"), -- music-note-02
    ["Archetype Nolly X"] = glyph("F1F28"),     -- music-note-02
    ["Audio MIDI Setup"] = glyph("F1E84"),      -- mixer
    ["Bloom"] = glyph("F1AAD"),                 -- folder-01
    ["Code"] = glyph("F262F"),                  -- visual-studio-code
    ["Dia"] = glyph("F1427"),                   -- arc-browser
    ["Discord"] = glyph("F193C"),               -- discord
    ["Feishin"] = glyph("F1F28"),               -- music-note-02
    ["Finder"] = glyph("F1417"),                -- apple-finder
    ["Figma"] = glyph("F1A15"),                 -- figma
    ["Fortin Nameless Suite X"] = glyph("F1F28"), -- music-note-02
    ["Ghostty"] = glyph("F2332"),               -- source-code-square (closest fallback for missing computer-terminal-01)
    ["Google Chrome"] = glyph("F176C"),         -- chrome
    ["Calendar"] = glyph("F1631"),              -- calendar-03
    ["Mail"] = glyph("F1DA3"),                  -- mail-01
    ["Microsoft Edge Dev"] = glyph("F15F0"),    -- browser
    ["Proton Drive"] = glyph("F1B8E"),          -- hard-drive
    ["Proton Pass"] = glyph("F222C"),           -- security-password
    ["Proton VPN"] = glyph("F2227"),            -- secured-network
    ["Reminders"] = glyph("F141C"),             -- apple-reminder
    ["Safari"] = glyph("F21D0"),                -- safari
    ["Settings"] = glyph("F224C"),              -- settings-01
    ["System Preferences"] = glyph("F224C"),    -- settings-01
    ["System Settings"] = glyph("F224C"),       -- settings-01
    ["Slack"] = glyph("F22E7"),                 -- slack
    ["Soldano SLO100 X"] = glyph("F1F28"),      -- music-note-02
    ["Spotify"] = glyph("F2348"),               -- spotify
    ["TIDAL"] = glyph("F2641"),                 -- vynil-02
    ["Transmission"] = glyph("F196D"),          -- download-01
    ["Visual Studio Code"] = glyph("F262F"),    -- visual-studio-code
    ["WhatsApp"] = glyph("F2684"),              -- whatsapp
    ["Zed Preview"] = glyph("F17E9"),           -- code-square
    ["Zoom"] = glyph("F26F9"),                  -- zoom
  },
}
