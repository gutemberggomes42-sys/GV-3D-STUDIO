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
- `postgres` também pode armazenar fotos e vídeos na tabela de uploads do próprio banco
- `s3`: envia fotos e vídeos para um bucket externo, retornando URL pública no sistema

Se `PRINTFLOW_POSTGRES_URL` estiver configurado, o sistema migra automaticamente o conteúdo do JSON local para o banco na primeira leitura. Se `PRINTFLOW_STORAGE_PROVIDER=postgres`, os novos uploads passam a ser armazenados no próprio PostgreSQL. Se `PRINTFLOW_STORAGE_PROVIDER=s3`, os novos uploads passam a ser enviados para o bucket externo.

## Variáveis de ambiente

Banco principal opcional:

- `PRINTFLOW_POSTGRES_URL`
- `PRINTFLOW_POSTGRES_SSL`

Storage profissional opcional:

- `PRINTFLOW_STORAGE_PROVIDER=local|postgres|s3`
- `PRINTFLOW_SHOWCASE_SYNC_DIR`
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
- a vitrine sincronizada por pasta usa `PRINTFLOW_SHOWCASE_SYNC_DIR`; no Windows local, se ela não estiver definida, o app tenta `D:\Impressoes 3D`

## Biblioteca sincronizada

- quando o app encontra a pasta sincronizada, ele atualiza as bibliotecas e produtos automaticamente
- as fotos dessa biblioteca também são copiadas para `public/showcase-sync-cache`
- isso permite que o deploy no Render continue mostrando as imagens da vitrine mesmo sem acesso ao disco `D:\`
- os arquivos 3D completos continuam locais por padrão; para abri-los no servidor, o próprio servidor precisa ter acesso a uma pasta configurada em `PRINTFLOW_SHOWCASE_SYNC_DIR`
- o projeto agora inclui um snapshot commitado do catálogo sincronizado para o primeiro deploy no Render nascer com a vitrine pronta

### Watcher automatico da pasta

- para atualizar o snapshot local sempre que voce mudar algo em `D:\Impressoes 3D`, rode `npm run showcase:watch`
- para atualizar e tambem publicar sozinho no GitHub, rode `npm run showcase:watch:push`
- esse watcher precisa ficar rodando no computador que tem acesso a pasta `D:\Impressoes 3D`
- quando estiver em `showcase:watch:push`, uma nova colecao, foto ou mudanca de arquivo gera commit e push automaticos, entao o Render recebe um novo deploy sozinho
- no Render a mudanca nao aparece instantaneamente porque ainda depende do tempo do deploy terminar

## Hospedagem 24h

Agora o projeto pode rodar de 3 formas no Render:

- `fallback local`: disco persistente + JSON local
- `PostgreSQL`: banco principal no Render/Supabase/Neon usando `PRINTFLOW_POSTGRES_URL`
- `PostgreSQL + uploads`: banco principal e mídia no próprio Postgres do Render
- `S3`: mídia profissional em bucket externo para fotos e vídeos

- [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gutemberggomes42-sys/PrintFlow-3D)
- o projeto ja tem um `render.yaml` na raiz
- se você ficar no modo local, o disco deve ser montado em `/opt/render/project/src/storage`
- se usar PostgreSQL e S3, o disco vira apenas fallback e cache local
- a vitrine sincronizada por pasta funciona no Render usando o snapshot commitado e o cache de fotos em `public/showcase-sync-cache`
- se quiser abrir os arquivos 3D também no Render, configure `PRINTFLOW_SHOWCASE_SYNC_DIR` apontando para um diretório acessível pelo servidor ou mova esses arquivos para um storage externo

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
