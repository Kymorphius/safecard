// 根据 Anchor IDL 生成 Kit 客户端：node scripts/codama.mjs
import { readFileSync } from 'node:fs';
import { bottomUpTransformerVisitor, createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';

const idl = JSON.parse(readFileSync(new URL('../src/idl/safecard.json', import.meta.url)));
const codama = createFromRoot(rootNodeFromAnchor(idl));
// SOL 卡和代币卡的 PDA 都叫 card，Codama 会把后者自动改名为 buyTokenCardCard，这里改成 tokenCard
const rename = (n) => ({ ...n, name: 'tokenCard' });
codama.update(
  bottomUpTransformerVisitor([
    { select: '[pdaNode]buyTokenCardCard', transform: rename },
    { select: '[pdaLinkNode]buyTokenCardCard', transform: rename },
  ]),
);
await codama.accept(
  renderVisitor('.', { generatedFolder: 'src/generated', syncPackageJson: false }),
);
console.log('generated src/generated');
