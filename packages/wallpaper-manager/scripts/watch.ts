import chalk from 'chalk';
import { watch } from 'chokidar';

import { compile } from './compile';

watch('.').on('all', async () => {
  console.log(chalk.yellow('👀 File change detected, recompiling...'));
  await compile({ minify: false });
  console.log(chalk.green('✅ Success.'));
});
