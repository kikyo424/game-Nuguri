const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 실제 HTML의 물리 업데이트를 실행하며 브라우저 입출력만 대체한다.
function runTests() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  function game() {
    const noop = () => {};
    const element = { getContext: () => ({}), addEventListener: noop };
    const context = vm.createContext({
      document: {
        getElementById: () => element,
        querySelectorAll: () => [],
        addEventListener: noop,
      },
      window: { addEventListener: noop },
      localStorage: { getItem: () => null, setItem: noop },
      requestAnimationFrame: noop,
    });
    vm.runInContext(script, context);
    vm.runInContext('start(); enemies = []; player.x = 104;', context);
    return code => vm.runInContext(code, context);
  }

  let count = 0;
  // 위/아래로 이동하며 중간층을 조금 지나친 뒤 좌우로 빠져나온다.
  for (const floor of [1, 2]) {
    for (const vertical of ['ArrowUp', 'ArrowDown']) {
      for (const horizontal of ['ArrowLeft', 'ArrowRight']) {
        const run = game();
        const from = vertical === 'ArrowUp' ? floor - 1 : floor + 1;
        run(`player.y = floors[${from}] - player.h; keys.add('${vertical}');
          for (let i = 0; i < 108; i++) update(STEP);
          keys.delete('${vertical}'); keys.add('${horizontal}');
          for (let i = 0; i < 20; i++) update(STEP);`);
        assert.equal(run('player.ladder === null && player.ground'), true,
          `${floor + 1}층 ${vertical} → ${horizontal}: 사다리에서 내려야 함`);
        assert.equal(run('player.y + player.h'), [552, 454, 356][floor]);
        assert.equal(run(`player.x ${horizontal === 'ArrowLeft' ? '<' : '>'} 104`), true);
        count++;
      }
    }
  }

  const diagonal = game();
  diagonal("keys.add('ArrowUp'); for(let i=0;i<105;i++)update(STEP); keys.add('ArrowRight'); for(let i=0;i<20;i++)update(STEP);");
  assert.equal(diagonal('player.ground && player.ladder === null && player.x > 104'), true,
    '층 도착 시 좌우 입력이 다음 사다리 진입보다 우선해야 함');
  count++;

  const continuous = game();
  continuous("keys.add('ArrowUp');for(let i=0;i<220;i++)update(STEP)");
  assert.equal(continuous('player.y + player.h < floors[2]'), true,
    '위 입력만 유지하면 여러 층을 연속으로 올라가야 함');
  count++;

  const middle = game();
  middle("keys.add('ArrowUp');for(let i=0;i<50;i++)update(STEP);keys.clear();keys.add('ArrowRight');jumpQueued=true;update(STEP)");
  assert.equal(middle('player.ladder !== null && player.x === 104 && player.vy === 0 && !jumpQueued'), true,
    '층 사이에서는 옆으로 순간 이동하거나 점프할 수 없어야 함');
  count++;
  return `${count} ladder regression checks passed`;
}

module.exports = runTests;
if (require.main === module) console.log(runTests());
