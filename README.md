# Memory Game · Quem é quem?

Jogo da memória online para a dinâmica de apresentação do time de design.

Cada pessoa tem um par de cartas:

1. **Carta da pessoa**: foto, nome e uma identificação visual simples.
2. **Carta do perfil profissional**: competências, áreas de atuação, repertório complementar, impacto e traços profissionais.

O grupo tenta descobrir qual perfil pertence a qual pessoa. Quando um par é encontrado, a tela de **Par encontrado** mostra as duas cartas lado a lado e a própria pessoa apresenta o seu perfil, complementando o que está na carta.

## Modos de jogo

- **Clássico**: cartas viradas para baixo. Viram duas por vez; se não forem par, o grupo conversa e clica em "Virar de volta".
- **Cartas abertas**: todas as cartas à mostra. O grupo escolhe uma pessoa e um perfil; vale a dedução.

Detalhes:

- A lupa amplia qualquer carta aberta.
- Clicar num par já encontrado abre a apresentação de novo.
- O progresso fica salvo no navegador, então recarregar a página não perde o jogo.
- "Embaralhar" recomeça do zero.

## Estrutura

```
index.html            página do jogo
assets/css/style.css  visual
assets/js/game.js     regras do jogo
assets/js/cards.js    conteúdo das 14 pessoas (cartas)
assets/img/           fotos e cartas em imagem
vercel.json           configuração da Vercel (sem indexação em buscadores)
```

É um site estático: não precisa de build nem de `npm install`.

## Rodar localmente

Abra o `index.html` no navegador ou rode um servidor simples na pasta:

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

## Publicar (GitHub + Vercel)

```bash
git remote add origin https://github.com/SEU-USUARIO/memory-game.git
git branch -M main
git push -u origin main
```

Na Vercel: **Add New › Project › Import** o repositório. Em *Framework Preset*, escolha **Other**. Deixe *Build Command* e *Output Directory* vazios e clique em **Deploy**. Cada novo `git push` publica uma nova versão.

**Privacidade:** o jogo tem fotos e informações do time. O site já pede para não ser indexado por buscadores, mas qualquer pessoa com o link consegue abrir. Para restringir o acesso, ative **Settings › Deployment Protection** no projeto da Vercel.

## Atualizar ou adicionar uma pessoa

As cartas ficam em `assets/js/cards.js`, uma entrada por pessoa:

- `front`: HTML da carta da pessoa.
- `back`: HTML da carta de perfil.
- `frontImg` / `backImg`: em vez do HTML, uma imagem da carta (PNG na proporção 690×960).

Para adicionar alguém, copie uma entrada, troque `id`, `name` e `first`, e aponte para as novas cartas.
