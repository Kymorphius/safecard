// 根据 Anchor IDL 生成 Kit 客户端：node scripts/codama.mjs
import { readFileSync } from 'node:fs';
import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';

const idl = JSON.parse(readFileSync(new URL('../src/idl/safecard.json', import.meta.url)));
const codama = createFromRoot(rootNodeFromAnchor(idl));
await codama.accept(
  renderVisitor('.', { generatedFolder: 'src/generated', syncPackageJson: false }),
);
console.log('generated src/generated');
