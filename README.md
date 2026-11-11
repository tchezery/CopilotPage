# Alfred Local Copilot para Firefox

O projeto agora gera uma extensão Firefox que injeta o Alfred em páginas HTTP/HTTPS. Ele usa um modelo Ollama local para conversar sobre a aba, ler o conteúdo visível e executar tools com um cursor animado.

## Recursos

- chat flutuante inspirado no Felps do módulo Senior;
- contexto compacto com títulos, textos, tabelas e controles visíveis;
- tools para apontar, clicar, preencher, rolar e voltar;
- cursor animado que mostra onde o agente está atuando;
- histórico separado por origem e salvo localmente;
- bloqueio de senha, arquivos e ações sensíveis ou irreversíveis;
- endpoint e modelo configuráveis nas preferências da extensão.

Todo o tráfego do modelo passa pelo background da extensão diretamente para o Ollama. O conteúdo da aba não é enviado a serviços externos pelo Alfred.

## Preparar o Ollama

```bash
ollama pull qwen3.5:4b
ollama serve
```

O padrão é `http://127.0.0.1:11434` com `qwen3.5:4b`. Os dois valores podem ser alterados em **Extensões → Alfred Local Copilot → Preferências**.

## Gerar e instalar temporariamente

```bash
npm run build
```

No Firefox:

1. abra `about:debugging#/runtime/this-firefox`;
2. clique em **Carregar extensão temporária**;
3. selecione `dist/manifest.json`;
4. abra uma página HTTP/HTTPS e clique no Alfred flutuante.

O botão da barra do Firefox também abre ou fecha o painel. Páginas internas como `about:`, a loja de extensões e alguns domínios protegidos do Firefox não aceitam content scripts.

## Desenvolvimento

```bash
npm run dev
```

Esse comando reconstrói `dist/` quando um arquivo de `extension/` muda. Depois de uma alteração, clique em **Recarregar** na tela `about:debugging` e atualize a aba testada.

## Arquitetura

- `extension/content.js`: painel, leitura do DOM, tools e cursor;
- `extension/background.js`: conexão privilegiada com o Ollama;
- `extension/options.*`: configuração local do endpoint e modelo;
- `extension/manifest.json`: Manifest V3 específico para Firefox;
- `scripts/build-extension.mjs`: gera a pasta instalável `dist/`.

O protótipo React original continua em `src/` apenas como referência visual; ele não faz parte do pacote final da extensão.
