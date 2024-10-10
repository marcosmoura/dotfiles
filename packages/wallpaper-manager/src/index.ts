import { constants, promises } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import 'zx/globals';

const { access, readFile, writeFile } = promises;

const resolvePath = (pathToResolve: string) => {
  return path.resolve(homedir(), pathToResolve);
};

const wallpaperCacheLocation = resolvePath('.wallpapercache');

function toInt(value: string): number {
  return Number.parseInt(value, 10);
}

function getCacheKey(space: number) {
  return `space-${space}`;
}

async function getSpaceData() {
  const space = await $`yabai -m query --spaces --space | jq '.index'`;
  const display = await $`yabai -m query --spaces --space | jq '.display'`;

  if (display) {
    return {
      space: toInt(space.stdout),
      display: toInt(display.stdout) - 1,
    };
  }

  return {};
}

async function getWallpaperCache() {
  try {
    await access(resolvePath(wallpaperCacheLocation), constants.R_OK | constants.W_OK);
  } catch {
    throw new Error('Could not access wallpaper cache.');
  }

  const cache = await readFile(wallpaperCacheLocation, 'utf8');

  if (cache) {
    return JSON.parse(cache);
  }
}

async function applyWallpaper(space: number, display: number, cache: Record<string, string>) {
  const wallpaperLocation = resolvePath(`.config/wallpapers/${space}.jpg`);

  try {
    await $`wallpaper set ${wallpaperLocation} --screen ${display}`;
  } catch {
    throw new Error('Could not set wallpaper.');
  }

  const newCache = {
    ...cache,
    [getCacheKey(space)]: wallpaperLocation,
  };

  await writeFile(wallpaperCacheLocation, JSON.stringify(newCache, null, 2), 'utf8');

  console.log(chalk.green('✅ Wallpaper set: ' + wallpaperLocation));
}

async function onWallpaperChange() {
  const { space, display } = await getSpaceData();

  if ([space, display].includes(undefined)) {
    throw new Error('No space or display found.');
  }

  const cache = await getWallpaperCache();

  if (!cache[getCacheKey(space)]) {
    await applyWallpaper(space, display, cache);
  }
}

async function onCacheClean() {
  await writeFile(wallpaperCacheLocation, JSON.stringify({}, null, 2), 'utf8');

  console.log(chalk.yellow('\n\u2139\uFE0F  Wallpaper cache cleaned.'));

  await onWallpaperChange();
}

const [action = 'change'] = process.argv.slice(2);

if (action === 'change') {
  await onWallpaperChange();
}

if (action === 'clean') {
  await onCacheClean();
}
