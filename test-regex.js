const lines = [
  '     4/ 6  11  FARMASHOP (VTA. WEB)                      6/ 6                     312,65   ',
  '     5/11  11  VETERINARIA                                                        490,00   ',
  '     5/11  11  SPOTIFY P313C6CBB9                                    11,99                 ',
  '     6/ 9  11  METRAJE                                   3/ 4                     330,00   ',
  '     7/12  11  MERCADOPAGO*MERCADOL                     12/12                     451,03   ',
  '     7/ 9  11  DANIEL CASSIN                             3/ 6                     611,67   ',
  '     8/11  11  TIENDA INGLESA                                                   4.268,70   ',
  '    11/11  11  UBER   *TRIP                                          12,88                 ',
  '    10/10  11  LOJAS RENNER                              2/ 4                     279,30   ',
];

// Exact regex from source
const txRegex = /^\s{2,}(\d{1,2})\s*\/\s*(\d{1,2})\s+\d{1,3}\s{1,4}(.+?)\s{2,}(?:(\d{1,2})\s*\/\s*(\d{1,2})\s+)?([\d.,]+)\s*$/;

console.log('Testing regex:', txRegex.toString());
console.log('');

lines.forEach(l => {
  const m = txRegex.exec(l);
  if (m) {
    console.log(`MATCH: day=${m[1]} mo=${m[2]} desc=[${m[3].trim()}] inst=${m[4]}/${m[5]} amt=${m[6]}`);
  } else {
    console.log(`NO MATCH: [${l}]`);
    // Try simpler version
    const simple = /^\s+(\d{1,2})\/\s*(\d{1,2})\s+\d+\s+(.+?)\s{2,}/.exec(l);
    if (simple) console.log('  Simple partial: day=' + simple[1] + ' mo=' + simple[2] + ' desc=' + simple[3].trim());
  }
});
