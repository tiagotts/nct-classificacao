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

**Nota:** para gerar instalador `.dmg` no macOS, você precisa rodar `npm run dist:mac`
em um Mac. O mesmo vale para Windows — `npm run dist:win` precisa ser rodado em
um Windows (ou em CI). Não dá para gerar `.exe` no Mac sem configuração extra.

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
