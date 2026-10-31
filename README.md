# Gas Track

App de celular (página web instalável) para registrar cada abastecimento e ver o consumo do carro.

**Site:** https://wkk-ai.github.io/gas-track/

## O que faz

- Vários carros: cadastre pela placa (ABC1D23 ou ABC-1234) com apelido opcional e troque no botão do topo. Cada carro tem painel e histórico próprios; postos e locais são compartilhados.
- Abre direto no formulário: valor pago, litros, km rodados desde o último tanque, combustível, posto, data, viagem (sim/não + local) e observação.
- Posto e local da viagem viram lista suspensa depois da primeira vez.
- Painel: consumo médio (km/l), último vs média, gasto do mês, custo por km, preço médio do litro, ritmo mensal, média por tanque, intervalo entre abastecimentos, cidade vs viagem, gráficos, ranking de postos e lista de viagens.
- Histórico com editar e apagar.

## Como funciona por dentro

| Parte | Onde |
| --- | --- |
| Tela (Next.js, export estático) | GitHub Pages, publicado sozinho a cada push na `main` |
| API pequena (`api/index.ts`) | Neon Function `gastrack`, projeto Neon `gas-track-api` (us-east-1) |
| Banco | Neon Postgres, tabelas `cars` e `fillups` |

A API pede a senha do app no cabeçalho `x-app-key`. A senha fica guardada no Neon (variável `APP_KEY`), nunca no código.

## Instalar no iPhone

Safari → abrir o site → botão Compartilhar → **Adicionar à Tela de Início**.

## Atualizar a API

```bash
npx esbuild api/index.ts --bundle --minify --platform=node --target=node24 --format=esm --outfile=dist/index.mjs
zip -j function.zip dist/index.mjs
# subir pelo Neon (deploy_function, slug gastrack)
```
