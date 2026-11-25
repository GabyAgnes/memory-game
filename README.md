# Memory Game · Quem é quem?

Jogo da memória online para a dinâmica de apresentação do time de design.

Cada pessoa do time tem **uma carta**, com as duas metades lado a lado: a metade da pessoa (foto, nome, identificação visual) e a metade do perfil profissional (missão, skills, repertório, impacto, traços e diferencial). No tabuleiro, cada carta aparece **duas vezes**: são 14 pessoas e 28 cartas.

## Como funciona

1. O jogo começa com **todas as cartas abertas**. O time tem 10, 20 ou 30 segundos para memorizar onde está cada uma. O tempo é escolhido no topo da tela, e o botão "Já memorizamos" encerra a contagem antes.
2. As cartas viram para baixo. O time vira **duas por vez** e tenta formar os pares.
3. Quando o par se forma, abre a tela **Par encontrado** com a carta em tamanho grande, e **a pessoa da carta se apresenta** para o time.
4. Se não for par, as cartas viram de volta sozinhas.

Detalhes:

- Clicar numa carta já encontrada abre a apresentação de novo.
- O placar mostra pares, tentativas e tempo.
- O progresso fica salvo no navegador.
- "Novo jogo" embaralha e recomeça pela memorização.

## Estrutura

```
index.html            página do jogo
assets/css/style.css  visual
assets/js/game.js     regras do jogo
assets/js/cards.js    as 14 cartas (uma por pessoa)
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

- `front` + `back`: HTML das duas metades da carta.
- `cardImg`: em vez do HTML, a carta inteira em imagem (1536×1024).

Para adicionar alguém, copie uma entrada e troque `id`, `name` e `first`. O jogo duplica a carta sozinho.
