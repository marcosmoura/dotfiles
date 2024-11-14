local colors = require("config.utils.colors")
local deepMerge = require("config.utils.deepMerge")
local execute = require("config.utils.execute")
local memoize = require("config.utils.memoize")

local fontSize = 13
local artworkWidth = 36
local spacing = 12
local padding = 4
local gap = 20

local artworkCache = {}

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

local getAppleMusicArtworkPath = memoize(function(extension, trackName)
  local tempDir = "/tmp/hammerspoon-temp/artworks"
  local artworkPath = tempDir .. "/" .. hs.hash.SHA1(trackName) .. extension

  local _, success = execute("mkdir -p " .. tempDir)

  if not success then
    return nil
  end

  return artworkPath
end)

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

local isPlayerRunning = function(name)
  local player = hs.application.find(name, true)

  if not player then
    return false
  end

  return player:isRunning()
end

local isPlayer = function(name, module)
  local isRunning = isPlayerRunning(name)

  if isRunning then
    local state = module.getPlaybackState()

    return state == module.state_playing or state == module.state_paused
  end

  return false
end

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

local mergeWithDefaultStyle = memoize(function(style)
  return deepMerge({
    font = {
      name = "Maple Mono",
      size = fontSize,
    },
    color = { hex = "#fff" },
    paragraphStyle = {
      maximumArtworkWidth = artworkWidth,
      minimumArtworkWidth = artworkWidth,
    },
    shadow = {
      offset = { h = -1, w = 0 },
      color = { hex = "#000", alpha = 0.4 },
      blurRadius = 2,
    },
  }, style)
end)

local getMusicIcon = function(name)
  if name == "Apple Music" then
    return ""
  end

  if name == "Spotify" then
    return ""
  end

  return "󰎆"
end

local getNormalizedTrackInfo = memoize(function(info, truncateNumber)
  local shouldTruncate = truncateNumber ~= 0 and string.len(info) > truncateNumber
  local normalized = string.gsub(info, "^%s*(.-)%s*$", "%1")

  if shouldTruncate then
    normalized = string.sub(normalized, 1, truncateNumber)
    normalized = normalized .. "…"
  end

  return normalized
end)

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

  return hs.styledtext.new(message, mergeWithDefaultStyle({}))
end)

local getMusicStateIcon = function(isPlaying)
  local icon = isPlaying and "" or " "

  return hs.styledtext.new(
    icon,
    mergeWithDefaultStyle({
      font = {
        name = "Symbols Nerd Font Mono",
        size = fontSize + 2,
      },
      lineBreak = "truncateTail",
      allowsTighteningForTruncation = true,
    })
  )
end

local getAppIconStyledText = memoize(function(currentMusic)
  local icon = getMusicIcon(currentMusic.player)

  return hs.styledtext.new(
    icon .. " ",
    mergeWithDefaultStyle({
      font = {
        name = "Symbols Nerd Font Mono",
        size = fontSize + 2,
      },
      lineBreak = "truncateTail",
      allowsTighteningForTruncation = true,
    })
  )
end)

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

local createCanvas = function()
  local screen = hs.screen.mainScreen()
  local screenFrame = screen:fullFrame()

  local canvasFrame = {
    x = gap - padding / 2,
    y = screenFrame.y + screenFrame.h - artworkWidth - padding * 2 - 13,
    w = screenFrame.w / 3 + padding * 2,
    h = artworkWidth + padding * 2,
  }
  local canvas = hs.canvas.new(canvasFrame)

  if not canvas then
    return nil
  end

  canvas:level(hs.canvas.windowLevels.normal - 1)
  canvas:behavior(hs.canvas.windowBehaviors.canJoinAllSpaces)
  canvas:mouseCallback(onCanvasClick)

  canvas:insertElement({
    type = "rectangle",
    action = "clip",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 8, yRadius = 8 },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "fill",
    trackMouseDown = true,
    fillColor = { hex = colors.crust.hex, alpha = 0.5 },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "clip",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 6, yRadius = 6 },
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

local updateCurrentMusic = memoize(function(canvas, currentMusic)
  if not currentMusic or currentMusic.track == "" then
    canvas:hide()
    return
  end

  local music = getMusicStyledText(currentMusic)
  local playerIcon = getAppIconStyledText(currentMusic)
  local stateIcon = getMusicStateIcon(currentMusic.isPlaying)

  if not music or not playerIcon or not stateIcon then
    return
  end

  canvas[4].image = currentMusic.artwork
  canvas[6].text = music:setString(stateIcon, 2, 2):setString(playerIcon, 1, 1)
  canvas:show()

  local textDrawing = hs.drawing.getTextDrawingSize(canvas[6].text)

  if not textDrawing then
    return
  end

  local fullCanvasWidth = textDrawing.w + artworkWidth + spacing * 2 + padding

  canvas[1].frame.w = fullCanvasWidth
  canvas:size({
    w = fullCanvasWidth,
    h = canvas:frame().h,
  })
end)

local module = {}

local canvas = createCanvas()
local timer = nil

module.start = function()
  local update = function()
    updateCurrentMusic(canvas, getCurrentMusic())
  end

  local createTimer = function()
    if timer then
      timer:stop()
      timer = nil
    end

    timer = hs.timer.doEvery(1, update)
  end

  local event = hs.eventtap.new({ hs.eventtap.event.types.systemDefined }, function(event)
    local systemKey = event:systemKey().key
    local events = { "PLAY", "NEXT", "PREVIOUS" }

    if hs.fnutils.contains(events, systemKey) then
      update()
      createTimer()
    end
  end)

  update()
  createTimer()

  event:start()
end

return module
