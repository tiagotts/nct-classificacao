# NCT Classificação

Aplicativo desktop (Electron) para gerar a classificação após a fase de grupos
de etapas do **Circuito NCT de Vôlei de Praia**.

Faz upload da planilha da etapa, aplica os critérios de desempate do regulamento
e monta a chave do mata-mata. A configuração (nº de classificados por grupo,
fórmula do average, ordem dos critérios, cruzamentos) é ajustável por torneio.

---

## Como rodar localmente

### 1. Instalar o Node.js (uma vez só)

Baixe o instalador da versão **LTS** em https://nodejs.org/ e instale normalmente
(`.pkg` no macOS, `.msi` no Windows). Para confirmar que ficou tudo certo, abra
o Terminal (macOS) ou PowerShell (Windows) e digite:

```
node --version
npm --version
```

### 2. Instalar dependências do projeto

Abra o Terminal/PowerShell dentro desta pasta (`nct/`) e rode:

```
npm install
```

Vai baixar o Electron e os outros pacotes em `node_modules/`. Demora alguns
minutos na primeira vez.

### 3. Rodar o app

```
npm start
```

Abre uma janela nativa rodando o app. Para fechar, basta fechar a janela.

---

## Como usar

1. **Arquivo → Abrir planilha…** (⌘O no Mac, Ctrl+O no Windows) ou arrasta o
   `.xlsx` para a área de upload.
2. O app lê as abas **TABELA**, **GRUPOS** e **REGULAMENTO** da planilha,
   detecta automaticamente o número de duplas/grupos e tenta inferir os
   cruzamentos do mata-mata.
3. Revise a configuração no painel **2. Configuração da etapa** — ajuste o que
   precisar (fórmula do average, ordem dos critérios de desempate, classificados
   por grupo, repescagem, cruzamentos).
4. Clique em **▶ Calcular classificação**. O app mostra:
   - Os 18 jogos lidos
   - Classificação por grupo (com indicação do critério de desempate aplicado)
   - Ranking geral dos classificados (seed 1, 2, 3…)
   - Cruzamentos do mata-mata montados pelas seeds

A última configuração usada fica salva automaticamente e volta na próxima
abertura do app.

---

## Como gerar o instalador para distribuir

Para gerar `.dmg` (macOS), `.exe` (Windows) ou `AppImage` (Linux):

```
npm run dist
```

Ou para uma plataforma específica:

```
npm run dist:mac     # macOS (.dmg)
npm run dist:win     # Windows (.exe)
npm run dist:linux   # Linux (AppImage)
```

Os instaladores são gerados em `dist/`. Você pode mandar esses arquivos para o
seu amigo organizador instalar como qualquer outro programa.

**Nota:** o instalador precisa ser gerado no mesmo sistema do destino, porque
o app usa um módulo nativo (`better-sqlite3`). `npm run dist:mac` roda no Mac;
o `.exe` do Windows **não** pode ser gerado no Mac.

### Instalador do Windows pelo GitHub Actions

O jeito mais simples de gerar o `.exe` sem ter um PC Windows: o workflow
`.github/workflows/build-windows.yml` constrói o instalador num Windows na nuvem.

1. Garanta que o projeto está num repositório no GitHub.
2. Aba **Actions** → workflow **Build Windows** → **Run workflow**.
3. Ao terminar (~5 min), baixe o artefato **instalador-windows** (um `.zip`
   com o `.exe` dentro).
4. Como alternativa, crie uma tag `v*` (ex.: `git tag v0.1.0 && git push --tags`):
   além de gerar, o workflow publica uma **Release** com o `.exe` anexado.

Envie o `.exe` para o usuário Windows — ele instala como qualquer programa.
Na primeira execução o Windows mostra o aviso do SmartScreen (app sem
assinatura digital): basta clicar em **Mais informações → Executar assim mesmo**.

---

## Estrutura do projeto

```
nct/
├── package.json     ← config do app + dependências
├── main.js          ← processo principal: cria a janela, menu nativo,
│                     diálogo de abrir arquivo, persistência de config
├── preload.js       ← ponte segura entre Node (main) e HTML (renderer)
├── index.html       ← a UI inteira (tela, motor de classificação, parser .xlsx)
├── README.md        ← este arquivo
├── .gitignore
└── (após `npm install`)
    └── node_modules/
└── (após `npm run dist`)
    └── dist/        ← instaladores prontos
```

---

## Onde fica a configuração salva

O app salva a última configuração (critérios de desempate, fórmula do average,
cruzamentos…) em:

- **macOS:** `~/Library/Application Support/nct-classificacao/config.json`
- **Windows:** `%APPDATA%\nct-classificacao\config.json`
- **Linux:** `~/.config/nct-classificacao/config.json`

Apagar esse arquivo restaura os defaults.

---

## Limitações conhecidas desta versão (0.1 — PoC)

- Tratamento de W × 0 ainda não implementado (atualmente um jogo sem placar é
  ignorado nas contas; precisa virar uma marcação explícita no app).
- Tratamento de desistência idem.
- O mata-mata propriamente dito (lançamento dos placares de QF/SF/Finais) ainda
  não está implementado — o app monta a chave mas não conduz os jogos.
- Ranking acumulado da temporada (somando várias etapas) ainda não existe.
