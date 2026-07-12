import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, 'worker-assets');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'index.html'), join(output, 'index.html'));
await cp(join(root, 'src'), join(output, 'src'), {
  recursive: true,
  filter(source) {
    return !source.endsWith('.test.js') && !source.endsWith('.integration.test.js');
  },
});

console.log('Built static Worker assets in worker-assets/.');
