import { centeredPlacement, contentBounds, needsCentering, uniformBackground } from "../src/lib/logoCentering";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, message?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    if (message) console.error(`    Erro: ${message}`);
    failed++;
  }
}

// Imagem w×h branca com um retângulo escuro em (x,y,rw,rh)
const img = (w: number, h: number, rect?: [number, number, number, number], bg = [255, 255, 255, 255]) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(bg, i * 4);
  if (rect) {
    const [x, y, rw, rh] = rect;
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) d.set([120, 60, 80, 255], (yy * w + xx) * 4);
  }
  return d;
};

function main() {
  console.log("=== INICIANDO TESTES DE CENTRALIZAÇÃO DO LOGO ===");

  // Logo deslocado para a direita (como o da Michele)
  const off = img(100, 100, [30, 35, 65, 30]);
  const bg = uniformBackground(off, 100, 100);
  assert("fundo branco liso reconhecido", !!bg && bg[0] === 255);
  const b = contentBounds(off, 100, 100, bg!);
  assert("acha o desenho", JSON.stringify(b) === JSON.stringify({ x: 30, y: 35, w: 65, h: 30 }), JSON.stringify(b));
  assert("deslocado: precisa centralizar", needsCentering(b!, 100, 100));
  const p = centeredPlacement(b!, 512);
  assert("no quadrado final fica no meio (mesma margem dos dois lados)", Math.abs(p.x - (512 - p.x - p.w)) <= 1 && Math.abs(p.y - (512 - p.y - p.h)) <= 1, JSON.stringify(p));
  assert("proporção mantida e cabe na margem de 12%", Math.abs(p.w / p.h - 65 / 30) < 0.03 && p.w <= 512 * 0.76 + 1, JSON.stringify(p));

  // Já centralizado: não mexe
  const ok = img(100, 100, [20, 30, 60, 40]);
  assert("já centralizado: não precisa", !needsCentering(contentBounds(ok, 100, 100, uniformBackground(ok, 100, 100)!)!, 100, 100));

  // Foto (cantos diferentes): não mexe
  const foto = img(10, 10);
  foto.set([0, 0, 0, 255], (9 * 10 + 9) * 4);
  assert("foto com cantos diferentes: deixa como está", uniformBackground(foto, 10, 10) === null);

  // Só fundo
  assert("imagem só de fundo: nada a recortar", contentBounds(img(10, 10), 10, 10, [255, 255, 255, 255]) === null);

  // Fundo transparente
  const tr = img(50, 50, [5, 20, 30, 10], [0, 0, 0, 0]);
  const tb = uniformBackground(tr, 50, 50);
  assert("fundo transparente reconhecido", !!tb && tb[3] === 0);
  assert("acha o desenho no transparente", JSON.stringify(contentBounds(tr, 50, 50, tb!)) === JSON.stringify({ x: 5, y: 20, w: 30, h: 10 }));

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
