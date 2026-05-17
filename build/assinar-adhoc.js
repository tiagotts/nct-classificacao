// Hook afterPack do electron-builder.
// O electron-builder pula a assinatura de código quando não há um
// certificado Developer ID válido no chaveiro. No Apple Silicon um app
// sem assinatura válida é encerrado pelo sistema assim que abre (crash
// SIGTRAP, sem mensagem). Esta assinatura ad-hoc (codesign --sign -)
// gera uma assinatura válida e o app passa a rodar.
// Em Windows/Linux o hook não faz nada.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = function assinarAdHoc(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const nomeApp = context.packager.appInfo.productFilename;
  const caminhoApp = path.join(context.appOutDir, `${nomeApp}.app`);

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', caminhoApp],
    { stdio: 'inherit' });
  console.log(`  • assinatura ad-hoc aplicada  app=${caminhoApp}`);
};
