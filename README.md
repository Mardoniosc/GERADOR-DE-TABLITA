# Gerador de Tablita – Damas Brasileiras (64 casas)

Aplicação web Angular, 100% local e instalável (PWA), que sorteia uma **Tablita oficial** e mostra a posição resultante no tabuleiro.

As posições vêm das **tabelas oficiais de sorteio da IDF** (International Draughts Federation, Seção 64) para Damas Brasileiras. Cada registro foi importado do documento original e executado por um motor de regras próprio antes de entrar no sorteio. Nenhuma posição foi inventada ou completada por inferência.

> Leia o **[relatório de auditoria](docs/RELATORIO-AUDITORIA.md)**: fontes, contagens, duplicidades, pendências e divergências (745 × 772; Tábuas A/B/C).

## Requisitos

- Node.js **22.18 ou superior** (os scripts de importação usam o *type stripping* nativo do Node)
- npm 10+

## Instalação e execução

```bash
npm install
```

```bash
npm start
```

Abra http://localhost:4200.

### Produção

```bash
npm run build
```

O build fica em `dist/gerador-de-tablita/browser`. Ele pode ser publicado em qualquer hospedagem estática com HTTPS. O service worker só funciona em HTTPS ou `localhost`.

Para testar o build, inclusive offline e instalação como app:

```bash
npm run serve:prod
```

Abra http://localhost:8080, aguarde o primeiro carregamento e depois teste sem rede.

### Testes

```bash
npm test
```

São 69 testes em Vitest: motor de regras, interpretação da notação, amostras reais de cada categoria, integridade da coleção, serviço de sorteio, atualização do PWA, tabuleiro e botão **GERAR TABLITA**.

## Publicação automática

Qualquer push na branch `main` executa o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Ele roda os testes, compila o Angular para o subdiretório do GitHub Pages, valida os arquivos gerados e publica a nova versão. Se um teste ou uma verificação falhar, nada é publicado.

```
push em main ──► npm ci ──► npm test ──► build:pages ──► verify:dist ──► upload ──► deploy (GitHub Pages)
```

- **Mecanismo oficial:** `actions/configure-pages`, `actions/upload-pages-artifact` e `actions/deploy-pages`. Não há pacote npm `gh-pages` nem commits de arquivos compilados.
- **Sem branch `gh-pages`:** com a fonte "GitHub Actions", o site é publicado como artefato no ambiente `github-pages`. Uma branch `gh-pages` não é necessária e não é usada.
- **Segurança:** o workflow usa só o `GITHUB_TOKEN` automático, com permissões `contents: read`, `pages: write` e `id-token: write`. Nenhum token pessoal nem segredo é necessário.
- **Concorrência:** grupo `pages` com `cancel-in-progress: false`. Uma publicação em andamento termina, e as execuções pendentes mais antigas são substituídas pela mais recente. Assim, um build antigo nunca sobrescreve um mais novo.
- **Node.js:** a versão vem de [`.nvmrc`](.nvmrc).

### Configuração inicial no GitHub (uma vez)

1. **Branch principal `main`.** O workflow publica a partir de `main`. Se o repositório ainda usa `master`, renomeie em **Settings → General → Default branch → ✏️ (Rename branch)** para `main`. O GitHub redireciona PRs e links. Depois, na sua máquina:
   ```bash
   git branch -m master main
   ```
   ```bash
   git fetch origin && git branch -u origin/main main && git remote set-head origin -a
   ```
2. **Fonte de publicação.** Abra **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**.
3. **Ações habilitadas.** Em **Settings → Actions → General**, confirme que as GitHub Actions estão permitidas. As ações usadas são todas oficiais (`actions/*`).
4. O repositório precisa ser **público** no plano gratuito do GitHub.
5. **Branch autorizada no ambiente `github-pages`.** Ao ativar o Pages, o GitHub cria o ambiente `github-pages` e libera a publicação apenas a partir da branch padrão daquele momento. Renomear a branch depois **não** atualiza essa regra. Em **Settings → Environments → github-pages → Deployment branches and tags**, a lista deve conter `main`. Se aparecer `master`, remova-a e adicione `main`.

### Primeiro deploy

- Faça push na `main`, **ou**
- Abra **Actions → Deploy GitHub Pages → Run workflow** (execução manual, `workflow_dispatch`).

### Acompanhar e acessar

- Acompanhe em **Actions → Deploy GitHub Pages**. O job **Testes e build** mostra no resumo a lista de verificações do build. O job **Publicar** mostra o link do site.
- **URL publicada: https://tablita.servicosmsc.com.br/** (domínio próprio). O endereço também aparece em **Settings → Pages** e no ambiente **github-pages** da página inicial do repositório.
- Sem domínio próprio, o GitHub publica em `https://<usuário>.github.io/<repositório>/`.

### Domínio próprio

O domínio é configurado só no GitHub. Não é preciso mudar o workflow nem o código.

1. **DNS:** registro `CNAME` com o nome do subdomínio (ex.: `tablita`) apontando para `<usuário>.github.io`, sem o nome do repositório.
2. **GitHub:** em **Settings → Pages → Custom domain**, informe o domínio, salve e, depois que o certificado estiver pronto, marque **Enforce HTTPS**. O service worker exige HTTPS.
3. **Novo deploy:** rode o workflow de novo (**Actions → Deploy GitHub Pages → Run workflow**) para gerar o build com `<base href="/">`. Sem isso, o site continua apontando JS e CSS para `/<repositório>/` e eles dão 404.

Com publicação via Actions, o arquivo `CNAME` no repositório não é usado. Para o navegador, o domínio novo é outro site, então quem instalou o PWA pelo endereço antigo precisa instalar de novo.

### base-href

O base-href é definido automaticamente, sem o nome do repositório fixo no código:

1. No CI, vem de `actions/configure-pages` (`base_path`): `/` para domínio próprio ou repositórios `<usuário>.github.io`, e `/<repositório>/` nos demais casos. Essa origem tem prioridade sobre as outras.
2. Localmente, `npm run build:pages` usa `config.pagesBaseHref` do `package.json`, hoje `"/"` por causa do domínio próprio. Se esse campo estiver vazio, usa o nome do repositório do `git remote origin`.
3. A variável `BASE_HREF` força qualquer valor.

Todos os caminhos do app são relativos ao `<base href>`: JS, CSS, ícones, `manifest.webmanifest`, `assets/data/*.json` e `ngsw-worker.js`. O `404.html` (cópia do `index.html`) faz qualquer endereço inexistente dentro do site abrir o app.

### Atualização do PWA após um deploy

O service worker compara os hashes do `ngsw.json` e baixa a nova versão em segundo plano. O app verifica atualizações ao abrir, a cada 30 minutos e quando volta ao primeiro plano. Quando a nova versão está pronta, aparece o aviso **"Nova versão disponível · Atualizar"**. Qualquer nova abertura da página já usa a versão mais recente, e se o cache ficar inconsistente o app recarrega sozinho.

### Testar o build do Pages localmente

```bash
npm run build:pages
```

```bash
npm run verify:dist
```

```bash
npm run serve:prod
```

O servidor local imita o GitHub Pages, inclusive o caminho do base-href e o `404.html`. Abra o endereço impresso no terminal: http://localhost:8080/ com o domínio próprio, ou http://localhost:8080/<repositório>/ sem ele.

### Diagnóstico de erros

| Sintoma | Causa provável / solução |
|---|---|
| Workflow não dispara no push | O push não foi na `main` (veja o passo 1) ou as Actions estão desabilitadas. |
| Erro em **Configurar GitHub Pages** ("Get Pages site failed" / 404) | A fonte do Pages não está em **GitHub Actions** (passo 2). |
| Falha em **Instalar dependências** | `package-lock.json` desatualizado: rode `npm install` localmente e faça commit do lockfile. |
| Falha em **Testes unitários** | Rode `npm test` localmente. Nada é publicado enquanto houver teste falhando. |
| Falha em **Verificar arquivos gerados** | O resumo do job mostra qual verificação falhou (base-href, JSON, manifest, service worker). Reproduza com `npm run build:pages` e `npm run verify:dist`. |
| Falha em **Publicar**: `Branch "main" is not allowed to deploy to github-pages due to environment protection rules` | A regra do ambiente ainda autoriza a branch antiga (ex.: `master`). Em **Settings → Environments → github-pages → Deployment branches and tags**, troque-a por `main` e use **Re-run failed jobs** na execução que falhou. |
| Site em branco ou 404 em JS/CSS | base-href incorreto. Confira o `<base href>` no código-fonte da página publicada. Depois de adicionar ou remover um domínio próprio, rode o workflow de novo. |
| Versão antiga continua aparecendo | Aguarde o aviso "Nova versão disponível" ou recarregue a página. Em último caso, limpe os dados do site no navegador. |

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção com service worker |
| `npm test` | Testes unitários (Vitest), execução única |
| `npm run test:watch` | Testes em modo observação |
| `npm run import:tablitas` | Reimporta as tabelas oficiais de `data-sources/` e regera `tablitas.json`, `metadata.json` e o relatório de auditoria |
| `npm run build:pages` | Build de produção para o GitHub Pages (base-href automático + `404.html`) |
| `npm run verify:dist` | Valida o build (index, base-href, JSON, manifest, service worker); falha com código 1 |
| `npm run serve:prod` | Serve o build como o GitHub Pages, em http://localhost:8080/ (ou no subdiretório do base-href) |
| `npm run icons` | Regera os ícones PWA |

## Dados

| Arquivo | Conteúdo |
|---|---|
| `src/assets/data/tablitas.json` | 1508 registros: 772 da edição vigente (IDF 2024) + 736 da edição 2017 ("745") |
| `src/assets/data/metadata.json` | Edições, contagens, casas retiradas (`***`), categorias, mapeamento CODEX (pendente) |
| `data-sources/idf/` | Documentos originais da IDF (DOCX/DOC/PDF) e extrações de texto usadas na importação |
| `data-sources/codex/` | Regras CBJD e trecho do CODEX (arts. 85, 86 e 94) |
| `docs/RELATORIO-AUDITORIA.md` | Relatório gerado pelo importador |

Exemplo de registro:

```json
{
  "id": "BR2024-XVII-09",
  "code": "XVII-9",
  "edition": "IDF-2024-BR-772",
  "category": "MOVES",
  "categoryName": "Sorteio de lances",
  "codexTabua": null,
  "notation": "ed4 bc5 db6 ca5 ab4 ab6",
  "source": "IDF – Table of draw in IDF competitions (772 positions) for Brazilian draughts…",
  "verified": true,
  "status": "VALID"
}
```

- `code` é a localização na tabela oficial: coluna em algarismos romanos + linha.
- `notation` preserva o texto da célula exatamente como está no documento.
- Só entram no sorteio registros `VALID` que o app também valida novamente ao carregar.

### Duas categorias estruturais

As tabelas da IDF têm dois tipos de entrada:

- **Sorteio de lances** (`MOVES`): `ab4 ba5 ed4` = coluna de origem + casa de destino, alternando brancas e pretas a partir da posição inicial. Capturas seguem a mesma forma (`db6` = d4 tomando c5).
- **Posição com peças deslocadas** (`POSITIONS`): `a3-a5 f6-g5` = desloca uma pedra branca e uma preta. `---` significa sem deslocamento. As brancas iniciam.

### Pendências (não resolvidas por inferência)

1. **Tábuas A/B/C do CODEX.** O CODEX (art. 85) cria as três tábuas, mas não lista seus lances, e nenhuma fonte acessível as relaciona às entradas da IDF. Por isso `codexTabua` é `null` e o app mostra "Tábua CODEX a confirmar". Quando houver confirmação documental, preencha `codexMapping.byCategory` em `scripts/import-tablitas.ts` (ou `codexTabua` por registro), mude o status para `CONFIRMED` e rode `npm run import:tablitas`. O app passa a exibir, por exemplo, "TÁBUA A – SORTEIO CONVENCIONAL".
2. **745 × 772.** A edição brasileira de 2017 ("745") está inativa na IDF desde 01/01/2024 e tem 736 posições efetivas. A vigente tem 772. As duas foram importadas e podem ser trocadas no app; a padrão é a vigente.
3. **Casa II-1 (`a1-a5`).** A notação está incompleta nos documentos oficiais. O registro ficou pendente e fora do sorteio.
4. **Numeração 1–32.** É convenção de exibição (b8 = 1 … g1 = 32). As tabelas usam notação algébrica.

## Arquitetura

```
src/app/
  core/
    engine/draughts-engine.ts       Regras das Damas Brasileiras + notação da Tablita (TS puro, sem Angular)
    models/                         board.model.ts, tablita.model.ts (somente tipos)
    services/
      board.service.ts              Geometria/numeração para apresentação
      tablita-notation.service.ts   Interpreta notação → tabuleiro (usa o motor)
      tablita.service.ts            Carrega, valida e sorteia (signals)
      app-update.service.ts         Atualização do PWA após novo deploy
    data/tablitas-integrity.spec.ts Validação automatizada da coleção
  features/generator/components/
    tablita-generator/              Página: cabeçalho, tabuleiro, botão, contador, edição
    tablita-result/                 Código, categoria, notação e lances interpretados
  shared/components/checkers-board/ Tabuleiro 8×8 reutilizável
scripts/                            Importador, ícones, build/verificação do Pages, servidor estático
.github/workflows/deploy.yml        CI/CD: testes → build → verificação → GitHub Pages
```

- O motor de regras é um único módulo TypeScript sem dependências. O importador (Node) e o app (Angular) usam o mesmo código, então a lógica de notação não é duplicada.
- O motor implementa captura obrigatória para frente e para trás, lei da maioria, dama voadora, regra turca e promoção só ao terminar o lance na última fileira.
- O sorteio usa `crypto.getRandomValues` com amostragem por rejeição, o que dá distribuição uniforme sobre os registros elegíveis.
- PWA: `ngsw-config.json` faz *prefetch* do app, dos JSON e dos ícones. Depois do primeiro carregamento, o app funciona sem internet.

## Stack

Angular 21 (standalone, signals, zoneless), TypeScript strict, SCSS, Vitest + jsdom, @angular/service-worker.

O arquivo `.npmrc` define `legacy-peer-deps=true` para contornar uma falha do resolvedor de peer dependencies do npm 10 (`Cannot read properties of null (reading 'edgesOut')`) com os pacotes do Angular 21.
