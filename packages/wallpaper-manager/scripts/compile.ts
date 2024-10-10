import { minify } from '@swc/core';
import { promises } from 'node:fs';
import { homedir } from 'node:os';
import resolver from 'oxc-resolver';
import { transform } from 'oxc-transform';

const { writeFile, readFile } = promises;

interface CompileOptions {
  minify?: boolean;
}

function resolve(root: string, path: string) {
  return resolver.sync(root, path).path;
}

async function compileSource(path: string) {
  const source = await readFile(path, 'utf8');
  const { code } = await transform(path, source, {
    lang: 'ts',
  });

  return code;
}

async function minifySource(source: string) {
  const { code } = await minify(source, {
    format: {
      comments: false,
    },
    compress: true,
    mangle: true,
    module: true,
  });

  return code;
}

export async function compile({ minify = false }: CompileOptions) {
  const sourcePath = resolve(process.cwd(), './src/index.ts');
  const targetPath = resolve(homedir(), './.config/zsh/modules/yabai/bin/wallpaper-manager');

  let compiledCode = await compileSource(sourcePath);

  if (minify) {
    compiledCode = await minifySource(compiledCode);
  }

  await writeFile(targetPath, compiledCode);
}
