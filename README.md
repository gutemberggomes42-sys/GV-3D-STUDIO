# PrintFlow 3D

Sistema completo para centralizar a operação de impressão 3D em um único lugar:

- portal do cliente com cadastro, upload e orçamento automático
- aprovação de pedido e pagamento
- fila de produção e distribuição por impressora
- monitoramento de máquinas e manutenção
- controle de materiais
- pós-processamento, qualidade e expedição
- financeiro e relatórios

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS 4
- persistência local em `storage/printflow-db.json`
- autenticação por sessão HTTP com cadastro real de usuários

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Primeiro acesso

- o sistema inicia sem dados fictícios
- o primeiro cadastro criado em `/acesso` vira administrador
- depois disso você pode cadastrar materiais reais com preço do rolo, peso e metragem
- os próximos cadastros entram como clientes

## Rotas principais

- `/` visão geral
- `/acesso` login e cadastro
- `/portal` portal do cliente
- `/admin` painel administrativo
- `/producao` módulo de produção
- `/maquinas` monitoramento das impressoras
- `/financeiro` financeiro e relatórios

## Precificação automática

Ao cadastrar um material, informe:

- valor pago no rolo ou frasco
- peso total em gramas
- metragem total em metros, quando for filamento

Com isso o sistema calcula automaticamente:

- custo por grama
- custo por metro
- metros estimados por peça
- custo de material e valor sugerido de cobrança

## Persistência

O app cria automaticamente o arquivo `storage/printflow-db.json` no primeiro acesso. Os uploads enviados pelo portal ficam em `public/uploads`.

## Hospedagem 24h

O caminho mais direto para este projeto hoje e usar o Render com disco persistente.

- o projeto ja tem um `render.yaml` na raiz
- o disco deve ser montado em `/opt/render/project/src/storage`
- isso preserva o banco local `printflow-db.json` e os uploads do sistema

Passos resumidos:

1. subir este projeto para um repositório no GitHub
2. criar uma conta no Render
3. abrir `Blueprints` no Render e conectar o repositório
4. sincronizar o `render.yaml`
5. aguardar o primeiro deploy e usar a URL publica do serviço

## Verificação

```bash
npm run lint
npm run build
```
