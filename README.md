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
- backend opcional em PostgreSQL para o `store` principal
- uploads locais ou storage profissional em S3/R2
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

O app cria automaticamente o arquivo `storage/printflow-db.json` no primeiro acesso.

Modos suportados:

- `local`: usa JSON em disco e uploads em `storage/uploads`
- `postgres`: salva todo o `snapshot` principal em PostgreSQL e mantém backups no banco
- `s3`: envia fotos e vídeos para um bucket externo, retornando URL pública no sistema

Se `PRINTFLOW_POSTGRES_URL` estiver configurado, o sistema migra automaticamente o conteúdo do JSON local para o banco na primeira leitura. Se `PRINTFLOW_STORAGE_PROVIDER=s3`, os novos uploads passam a ser enviados para o bucket externo.

## Variáveis de ambiente

Banco principal opcional:

- `PRINTFLOW_POSTGRES_URL`
- `PRINTFLOW_POSTGRES_SSL`

Storage profissional opcional:

- `PRINTFLOW_STORAGE_PROVIDER=local|s3`
- `PRINTFLOW_S3_BUCKET`
- `PRINTFLOW_S3_REGION`
- `PRINTFLOW_S3_ACCESS_KEY_ID`
- `PRINTFLOW_S3_SECRET_ACCESS_KEY`
- `PRINTFLOW_S3_ENDPOINT`
- `PRINTFLOW_S3_PUBLIC_BASE_URL`
- `PRINTFLOW_S3_PREFIX`
- `PRINTFLOW_S3_FORCE_PATH_STYLE`

Observação importante:

- o projeto ainda usa `DATABASE_URL` do Prisma para geração local do client e enums
- para o banco principal do app em produção, use `PRINTFLOW_POSTGRES_URL`
- isso evita conflito com o build atual do projeto

## Hospedagem 24h

Agora o projeto pode rodar de 3 formas no Render:

- `fallback local`: disco persistente + JSON local
- `PostgreSQL`: banco principal no Render/Supabase/Neon usando `PRINTFLOW_POSTGRES_URL`
- `S3`: mídia profissional em bucket externo para fotos e vídeos

- [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gutemberggomes42-sys/PrintFlow-3D)
- o projeto ja tem um `render.yaml` na raiz
- se você ficar no modo local, o disco deve ser montado em `/opt/render/project/src/storage`
- se usar PostgreSQL e S3, o disco vira apenas fallback e cache local

Passos resumidos:

1. subir este projeto para um repositório no GitHub
2. criar uma conta no Render
3. abrir `Blueprints` no Render e conectar o repositório
4. sincronizar o `render.yaml` e informar `OWNER_BOOTSTRAP_PASSWORD`
5. para banco profissional, preencher `PRINTFLOW_POSTGRES_URL`
6. para mídia profissional, preencher as variáveis `PRINTFLOW_S3_*`
7. aguardar o primeiro deploy e usar a URL publica do serviço

No primeiro deploy, o Render vai criar automaticamente o admin com:

- e-mail: `gutemberggg10@gmail.com`
- nome: `Guto`
- telefone: `64996435078`
- senha: o valor informado em `OWNER_BOOTSTRAP_PASSWORD`

## Verificação

```bash
npm run lint
npm run build
```
