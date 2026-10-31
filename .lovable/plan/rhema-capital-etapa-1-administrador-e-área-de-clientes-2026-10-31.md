# Rhema Capital — Etapa 1: administrador e área de clientes

## Resultado
Evoluir o sistema para vários clientes sem perder dados, preservando o login atual e a identidade visual. Leonardo passa a administrador/consultor, com acesso a todos os clientes. Cada cliente acessa exclusivamente seus próprios dados, com visualização ou edição conforme autorização.

## Cadastros e navegação
- Criar “Leonardo (pessoal)” e transferir para ele todos os dados atuais; será a seleção inicial do administrador.
- Criar “Cliente Teste”, sem e-mail ou CPF. Não conceder acesso a uma conta arbitrária: o vínculo de edição será feito quando o administrador identificar o usuário.
- Página Clientes, exclusiva do administrador: busca, botão Novo cliente, cadastro e página de detalhe com edição e gestão de acesso.
- Campos: nome, e-mail, CPF, telefone, observações e situação; contatos opcionais. Situações iniciais: ativo/inativo.
- Adicionar Importação e Clientes ao menu; Categorias somente se houver página própria. Hoje as categorias ficam em Configurações, sem rota independente.
- Seletor no topo para o administrador; clientes ficam limitados ao seu cadastro. Todas as telas financeiras passam a usar a seleção, incluindo saldos, categorias, previstos, importação e conciliação.
- Permissão de visualização também refletida nas ações da interface, sem substituir as verificações de segurança.

## Preservação e segurança
- Converter o dono atual em administrador sem permitir que usuários comuns se promovam pelo login.
- Administrador lê e grava dados de qualquer cliente. Usuário client só lê o cliente vinculado e só grava com acesso edit.
- Manter restrições financeiras existentes, como cancelamento/arquivamento em vez de exclusões destrutivas.
- Impedir vínculos cruzados: conta, categoria, transferência, previsto e importação precisam pertencer ao mesmo cliente.
- Não criar perfis de usuário ou novos métodos de login; não abrir cadastro público nesta etapa.

## Detalhes técnicos
- Criar `user_roles` separado, `clients` e `client_access`, com GRANTs explícitos e RLS. `client_access.user_id` único; acesso view/edit.
- Criar helpers de autorização com `SECURITY DEFINER`, `search_path` fixo e permissões restritas; adaptar `is_owner()` e `claim_ownership()` preservando compatibilidade e impedindo novos claims de administrador.
- Adicionar `client_id` e índice às oito tabelas financeiras existentes: `financial_accounts`, `categories`, `transactions`, `recurring_items`, `recurring_adjustments`, `categorization_rules`, `csv_mappings`, `import_batches`. `app_owner` e as tabelas de acesso não são dados financeiros de cliente.
- Fazer a mudança aditivamente: criar os cadastros necessários ao backfill, adicionar campos, preencher todos os registros existentes e somente depois tornar `client_id` obrigatório. Preservar `owner_id` como autoria, não como limite de acesso.
- Atualizar políticas, gatilhos, view de saldos e todas as funções de banco, especialmente `commit_csv_import` e `load_default_categories`, para autorização e isolamento por cliente.
- Toda função de servidor valida sessão e cliente solicitado, usando a conexão autenticada com RLS; nenhuma chave privilegiada no navegador.
- Incluir cliente nas consultas e nas chaves de cache. Ao trocar seleção, cancelar consultas e limpar dados anteriores antes de carregar o novo cliente, evitando mistura de saldos e formulários.
- Registrar decisões de arquitetura em `AGENTS.md` e atualizar o roadmap.

## Validação
- Testes reais de RLS: administrador lê ambos os clientes; cliente A não lê nem altera B; view não grava; edit grava apenas no próprio cliente; usuário sem vínculo não acessa dados nem altera papéis.
- Testar rejeição de relações cruzadas e autorização das funções de importação/categorias.
- Conferir contagens e saldos antes/depois da migração, garantindo que todos os dados atuais ficaram em Leonardo (pessoal).
- Testar login do administrador, cadastro/detalhe, troca de cliente, criação e leitura de movimentação, importação e regressões existentes.
- Testes de acesso de clientes exigem contas identificadas/autorizadas; não selecionar contas reais aleatoriamente.

## Fora do escopo e dependência
PDF e grade de projeção continuam em aberto. O cadastro Cliente Teste pode ser criado agora; seu acesso de edição depende da identificação da conta que receberá o vínculo.
