local wallpaper_prefix_path = "/tmp/hammerspoon-wallpapers/"

local function get_corner_data(raw_frame, radius, menubar_height)
  local frame = {
    x = raw_frame.x,
    y = raw_frame.y,
    w = raw_frame.w,
    h = raw_frame.h,
  }

  local cornerData = {
    { frame = { x = frame.x, y = 0 }, center = { x = radius, y = radius } },
    {
      frame = { x = frame.x + frame.w - radius, y = 0 },
      center = { x = frame.x + frame.w - radius, y = radius },
    },
    {
      frame = { x = frame.x, y = frame.y + frame.h - radius },
      center = { x = radius, y = frame.y + frame.h - radius },
    },
    {
      frame = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
      center = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
    },
  }

  if menubar_height ~= 0 then
    cornerData[#cornerData + 1] =
      { frame = { x = frame.x, y = menubar_height }, center = { x = radius, y = radius + menubar_height } }
    cornerData[#cornerData + 1] = {
      frame = { x = frame.x + frame.w - radius, y = menubar_height },
      center = { x = frame.x + frame.w - radius, y = radius + menubar_height },
    }
    cornerData[#cornerData + 1] = {
      frame = { x = frame.x, y = frame.y + frame.h - radius },
      center = { x = radius, y = frame.y + frame.h - radius },
    }
    cornerData[#cornerData + 1] = {
      frame = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
      center = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
    }
  end

  return cornerData
end

local function get_elements(image, frame, corner_data, radius, menubar_height)
  local elements = {}

  elements[#elements + 1] = {
    type = "image",
    image = image,
    frame = {
      x = 0,
      y = 0,
      w = frame.w,
      h = frame.h,
    },
  }

  for _, data in pairs(corner_data) do
    elements[#elements + 1] = { action = "build", type = "rectangle" }
    elements[#elements + 1] = {
      action = "clip",
      type = "circle",
      center = data.center,
      radius = radius,
      reversePath = true,
    }
    elements[#elements + 1] = {
      action = "fill",
      type = "rectangle",
      frame = { x = data.frame.x, y = data.frame.y, w = radius, h = radius },
      fillColor = {
        alpha = 1,
      },
    }
    elements[#elements + 1] = { type = "resetClip" }
  end

  if menubar_height ~= 0 then
    elements[#elements + 1] = {
      action = "fill",
      type = "rectangle",
      frame = { x = 0, y = 0, w = frame.w, h = menubar_height },
      fillColor = {
        hex = "#000000",
      },
    }
  end

  return elements
end

local ensure_wallpaper_dir = function()
  if hs.fs.attributes(wallpaper_prefix_path) == nil then
    hs.execute("mkdir -p " .. wallpaper_prefix_path)
  end
end

local get_wallpaper = function(current_space, screen)
  local wallpaper_path = "~/.config/wallpapers/" .. current_space .. ".jpg"

  if hs.fs.attributes(wallpaper_path) == nil then
    return
  end

  local image = hs.image.imageFromPath(wallpaper_path)

  if image == nil then
    return
  end

  image = image:setSize({ w = screen:fullFrame().w, h = screen:fullFrame().h }, true)

  return image
end

local create_wallpaper_with_corners = function(image, screen)
  local screen_frame = screen:fullFrame()
  local menubar_height = screen:frame().y - 1
  local radius = 16

  local corner_data = get_corner_data(screen_frame, radius, menubar_height)
  local elements = get_elements(image, screen_frame, corner_data, radius, menubar_height)

  local wallpaper_with_corners = hs.canvas.new({
    x = screen_frame.x,
    y = screen_frame.y,
    w = screen_frame.w,
    h = screen_frame.h,
  })

  if wallpaper_with_corners == nil then
    return
  end

  wallpaper_with_corners
    :appendElements(elements)
    :behavior(hs.canvas.windowBehaviors.canJoinAllSpaces)
    :level(hs.canvas.windowLevels.desktopIcon)

  return wallpaper_with_corners:imageFromCanvas()
end

local get_space_index = function(screen, space_id)
  local all_spaces = hs.spaces.allSpaces()
  local screen_uuid = screen:getUUID()

  if all_spaces == nil or all_spaces[screen_uuid] == nil then
    return 0
  end

  for index, space in ipairs(all_spaces[screen_uuid]) do
    if space == space_id then
      return index
    end
  end

  return 0
end

local apply_wallpaper = function(screen, path)
  local current_wallpaper = screen:desktopImageURL()

  if current_wallpaper == "file://" .. path then
    return
  end

  screen:desktopImageURL("file://" .. path)
end

local generate_wallpaper_for_space = function()
  local screen = hs.window.focusedWindow():screen()
  local current_space = get_space_index(screen, hs.spaces.activeSpaceOnScreen(screen))
  local wallpaper_path = wallpaper_prefix_path .. current_space .. ".jpg"

  ensure_wallpaper_dir()

  if hs.fs.attributes(wallpaper_path) then
    apply_wallpaper(screen, wallpaper_path)
    return
  end

  local raw_wallpaper = get_wallpaper(current_space, screen)

  if raw_wallpaper == nil then
    return
  end

  local wallpaper_with_corners = create_wallpaper_with_corners(raw_wallpaper, screen)

  if wallpaper_with_corners == nil then
    return
  end

  wallpaper_with_corners:saveToFile(wallpaper_path)
  apply_wallpaper(screen, wallpaper_path)
end

local module = {}

module.start = function()
  generate_wallpaper_for_space()
  hs.spaces.watcher.new(generate_wallpaper_for_space):start()
end

module.remove_wallpapers = function()
  hs.execute("rm -rf " .. wallpaper_prefix_path)
end

return module
