local assets = require("config.utils.assets")
local colors = require("config.utils.colors")
local memoize = require("config.utils.memoize")
local os = require("config.utils.os")
local widgets = require("config.utils.widgets")

local fontSize = 13
local artworkWidth = 36
local spacing = 12
local padding = 4
local gap = 20

local artworkCache = {}

--- Get the Spotify artwork
--- @param trackName string
--- @return hs.image|nil
local getSpotifyArtwork = memoize(function(trackName)
  if artworkCache[trackName] then
    return artworkCache[trackName]
  end

  local success, img = hs.osascript.javascript("Application('Spotify').currentTrack().artworkUrl()")

  if not success then
    return nil
  end

  local image = hs.image.imageFromURL(img)

  if not image then
    return nil
  end

  image = image:setSize({ h = artworkWidth, w = artworkWidth })

  artworkCache[trackName] = image

  return image
end)

--- Get the Apple Music artwork extension
--- @return string|nil
local getAppleMusicArtworkExtension = function()
  local success, ext = hs.osascript.applescript([[
    tell application "Music" to tell artwork 1 of current track
      if format is «class PNG » then
        return ".png"
      else
        return ".jpg"
      end if
    end tell
  ]])

  if not success then
    return nil
  end

  return ext
end

--- Get the Apple Music artwork path
--- @param extension string
--- @param trackName string
--- @return string|nil
local getAppleMusicArtworkPath = memoize(function(extension, trackName)
  local tempDir = "/tmp/hammerspoon-temp/artworks"
  local artworkPath = tempDir .. "/" .. hs.hash.SHA1(trackName) .. extension

  local _, success = os.execute("/bin/mkdir", { "-p", tempDir })

  if not success then
    return nil
  end

  return artworkPath
end)

--- Find the Apple Music artwork
--- @param trackName string
--- @return string|nil
local findAppleMusicArtwork = memoize(function(trackName)
  local pngPath = getAppleMusicArtworkPath(".png", trackName)
  local jpgPath = getAppleMusicArtworkPath(".jpg", trackName)

  if hs.fs.attributes(pngPath) then
    return pngPath
  end

  if hs.fs.attributes(jpgPath) then
    return jpgPath
  end

  return nil
end)

--- Fetch the Apple Music artwork
--- @param trackName string
--- @return string|nil
local fetchAppleMusicArtwork = memoize(function(trackName)
  local artworkPath = findAppleMusicArtwork(trackName)

  if artworkPath then
    return artworkPath
  end

  local extension = getAppleMusicArtworkExtension()

  if not extension then
    return nil
  end

  local artworkPath = getAppleMusicArtworkPath(extension, trackName)
  local success = hs.osascript.applescript(string.format(
    [[
    -- get the raw bytes of the artwork into a var
    tell application "Music" to tell artwork 1 of current track
      set srcBytes to raw data
    end tell

    -- get the filename to temp directory
    set fileName to POSIX file "%s"

    -- write to file
    set outFile to open for access file fileName with write permission

    -- truncate the file
    set eof outFile to 0

    -- write the image bytes to the file
    write srcBytes to outFile

    close access outFile
  ]],
    artworkPath
  ))

  if not success then
    return nil
  end

  return artworkPath
end)

--- Get the Apple Music artwork
--- @param trackName string
--- @return hs.image|nil
local getAppleMusicArtwork = memoize(function(trackName)
  if artworkCache[trackName] then
    return artworkCache[trackName]
  end

  local artworkPath = fetchAppleMusicArtwork(trackName)

  if not artworkPath then
    return nil
  end

  local image = hs.image.imageFromPath(artworkPath)

  if not image then
    return nil
  end

  image = image:setSize({ h = artworkWidth, w = artworkWidth })

  artworkCache[trackName] = image

  return image
end)

--- Check if the player is running
--- @param name string
--- @return boolean
local isPlayerRunning = function(name)
  local player = hs.application.find(name, true)

  if not player then
    return false
  end

  return player:isRunning()
end

--- Check if the player is active
--- @param name string
--- @param module hs.spotify|hs.itunes
--- @return boolean
local isPlayer = function(name, module)
  local isRunning = isPlayerRunning(name)

  if isRunning then
    local state = module.getPlaybackState()

    return state == module.state_playing or state == module.state_paused
  end

  return false
end

--- @class Music
--- @field player string
--- @field isPlaying boolean
--- @field track string
--- @field artist string
--- @field album string
--- @field artwork hs.image|nil

--- Get the current music
--- @return Music|nil
local getCurrentMusic = function()
  if isPlayer("Music", hs.itunes) then
    local trackName = hs.itunes.getCurrentTrack()

    return {
      player = "Apple Music",
      isPlaying = hs.itunes.isPlaying(),
      track = trackName,
      artist = hs.itunes.getCurrentArtist(),
      album = hs.itunes.getCurrentAlbum(),
      artwork = getAppleMusicArtwork(trackName),
    }
  end

  if isPlayer("Spotify", hs.spotify) then
    local trackName = hs.spotify.getCurrentTrack()

    return {
      player = "Spotify",
      isPlaying = hs.spotify.isPlaying(),
      track = trackName,
      artist = hs.spotify.getCurrentArtist(),
      album = hs.spotify.getCurrentAlbum(),
      artwork = getSpotifyArtwork(trackName),
    }
  end

  return nil
end

--- Get the music icon
--- @param name string
--- @return string
local getMusicIcon = function(name)
  if name == "Apple Music" then
    return ""
  end

  if name == "Spotify" then
    return ""
  end

  return "󰎆"
end

--- Get the normalized track info
--- @param info string
--- @param truncateNumber number
--- @return string
local getNormalizedTrackInfo = memoize(function(info, truncateNumber)
  local shouldTruncate = truncateNumber ~= 0 and string.len(info) > truncateNumber
  local normalized = string.gsub(info, "^%s*(.-)%s*$", "%1")

  if shouldTruncate then
    normalized = string.sub(normalized, 1, truncateNumber)
    normalized = normalized .. "…"
  end

  return normalized
end)

--- Get the music styled text
--- @param currentMusic Music
--- @return hs.styledtext|nil
local getMusicStyledText = memoize(function(currentMusic)
  local trackTruncateNumber = 50
  local artistTruncateNumber = 35
  local totalTruncateNumber = trackTruncateNumber + artistTruncateNumber

  if string.len(currentMusic.track) + string.len(currentMusic.artist) < totalTruncateNumber then
    trackTruncateNumber = 0
    artistTruncateNumber = 0
  end

  local trackName = getNormalizedTrackInfo(currentMusic.track, trackTruncateNumber)
  local artistName = getNormalizedTrackInfo(currentMusic.artist, artistTruncateNumber)
  local message = string.format("__%s - %s", trackName, artistName)

  return hs.styledtext.new(message, widgets.getTextStyle({}))
end)

--- Get the music state icon
--- @param isPlaying boolean
--- @return hs.styledtext|nil
local getMusicStateIcon = function(isPlaying)
  local icon = isPlaying and "" or " "

  return hs.styledtext.new(
    icon,
    widgets.getTextStyle({
      font = {
        name = "Symbols Nerd Font Mono",
        size = fontSize + 2,
      },
    })
  )
end

--- Get the app icon styled text
--- @param currentMusic Music
--- @return hs.styledtext|nil
local getAppIconStyledText = memoize(function(currentMusic)
  local icon = getMusicIcon(currentMusic.player)

  return hs.styledtext.new(
    icon .. " ",
    widgets.getTextStyle({
      font = {
        name = "Symbols Nerd Font Mono",
        size = fontSize + 2,
      },
    })
  )
end)

--- Handle the canvas click
local onCanvasClick = function()
  if isPlayer("Music", hs.itunes) then
    hs.application.launchOrFocus("Music")
    return
  end

  if isPlayer("Spotify", hs.spotify) then
    hs.application.launchOrFocus("Spotify")
    return
  end
end

--- Get the screen frame
--- @return hs.geometry
local getScreenFrame = function()
  return hs.screen.primaryScreen():fullFrame()
end

--- Create the canvas
local createCanvas = function()
  local screenFrame = getScreenFrame()

  local canvasFrame = {
    x = gap - padding / 2,
    y = screenFrame.y + screenFrame.h - artworkWidth - padding * 2 - 13,
    w = screenFrame.w / 3 + padding * 2,
    h = artworkWidth + padding * 2,
  }
  local canvas = widgets.create(canvasFrame, onCanvasClick)

  canvas:insertElement({
    type = "rectangle",
    action = "clip",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 9, yRadius = 9 },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "fill",
    trackMouseDown = true,
    fillColor = { hex = colors.crust.hex, alpha = 0.625 },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "fill",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 7, yRadius = 7 },
    fillColor = { hex = colors.crust.hex, alpha = 0.325 },
    frame = {
      w = artworkWidth,
      h = artworkWidth,
      x = padding,
      y = padding,
    },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "clip",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 7, yRadius = 7 },
    frame = {
      w = artworkWidth,
      h = artworkWidth,
      x = padding,
      y = padding,
    },
  })
  canvas:insertElement({
    type = "image",
    trackMouseDown = true,
    frame = {
      w = artworkWidth,
      h = artworkWidth,
      x = padding,
      y = padding,
    },
  })
  canvas:insertElement({
    type = "resetClip",
    trackMouseDown = true,
  })
  canvas:insertElement({
    type = "text",
    action = "fill",
    trackMouseDown = true,
    frame = {
      x = artworkWidth + spacing + padding,
      y = (artworkWidth - fontSize) / 2 + padding - 2,
      w = canvasFrame.w - (artworkWidth + spacing + padding),
      h = "100%",
    },
  })

  return canvas
end

--- Recalculate the canvas size
--- @param canvas hs.canvas
local recalculateCanvasSize = function(canvas)
  local textDrawing = hs.drawing.getTextDrawingSize(canvas[7].text)

  if not textDrawing then
    canvas:hide()
    return
  end

  local fullCanvasWidth = textDrawing.w + artworkWidth + spacing * 2 + padding
  local frame = canvas:frame()

  canvas[1].frame.w = fullCanvasWidth
  canvas:size({
    w = fullCanvasWidth,
    h = frame and frame.h or 0,
  })
  canvas:show()
end

--- Update the current music
--- @param canvas hs.canvas
--- @param currentMusic Music
local updateCurrentMusic = memoize(function(canvas, currentMusic)
  local hasMusicPlaying = currentMusic and currentMusic.track ~= ""

  if hasMusicPlaying then
    local music = getMusicStyledText(currentMusic)
    local playerIcon = getAppIconStyledText(currentMusic)
    local stateIcon = getMusicStateIcon(currentMusic.isPlaying)
    local text = music:setString(stateIcon, 2, 2):setString(playerIcon, 1, 1)

    if not music or not playerIcon or not stateIcon then
      canvas:hide()
      return
    end

    canvas[5].image = currentMusic.artwork
    canvas[5].frame = {
      w = artworkWidth,
      h = artworkWidth,
      x = padding,
      y = padding,
    }
    canvas[7].text = text
  else
    local size = assets.notPlaying:size()
    local iconSize = size and size.w or 0

    canvas[5].image = assets.notPlaying
    canvas[5].frame = {
      w = iconSize,
      h = iconSize,
      x = padding + (artworkWidth - iconSize) / 2,
      y = padding + (artworkWidth - iconSize) / 2,
    }
    canvas[7].text = hs.styledtext.new("No music playing :(", widgets.getTextStyle({}))
  end

  recalculateCanvasSize(canvas)
end)

local module = {}

local canvas = createCanvas()
local timer = nil
local screenWatcher = nil

module.start = function()
  local update = function()
    updateCurrentMusic(canvas, getCurrentMusic())
  end

  local createTimer = function()
    if timer then
      timer:stop()
      timer = nil
    end

    timer = hs.timer.doEvery(0.5, update)
  end

  screenWatcher = hs.screen.watcher.newWithActiveScreen(update)

  update()
  createTimer()
  screenWatcher:start()
end

return module
