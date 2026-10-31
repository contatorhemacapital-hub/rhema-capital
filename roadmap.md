# Roadmap
- [ ] Fundação: design system, menu lateral, login do proprietário, banco com RLS
- [ ] Contas: cadastro, edição, arquivamento, saldo inicial + data-base
- [ ] Categorias e subcategorias
- [ ] Movimentações: receitas/despesas (pendente/efetivada), transferências, estorno, filtros e busca
- [ ] Saldos por conta e consolidado
- [ ] Estrutura para importação CSV futura
- [ ] Testes de regras

## Fase 2
- [ ] A — Categorias padrão idempotentes
- [ ] B — Previstos recorrentes, ocorrências e histórico de reajustes
- [ ] C — Importação CSV, mapeamento por conta, revisão, duplicados e regras de categoria
- [ ] D — Conciliação por competência e confirmação de divergências
- [ ] Testes de regras, segurança e fluxo completo da Fase 2

## Etapas futuras (fora do escopo atual)
- [ ] Importação de PDF — aguardando etapa futura
- [ ] Grade de projeção mês a mês: planejado x realizado, análise por grupo, economias com saldo inicial real — aguardando etapa futura

## Etapa 1 — Administrador/consultor e clientes
- [ ] Papéis admin/client, preservação do login e migração dos dados para Leonardo (pessoal)
- [ ] Cadastros de clientes e permissões de visualização/edição com isolamento entre clientes
- [ ] Clientes: busca, cadastro, detalhe e seletor; menu com Importação e Clientes
- [ ] Todas as telas, consultas, gravações e importações vinculadas ao cliente selecionado
- [ ] Testes de RLS, vínculos entre registros, troca de cliente e regressão
- [ ] Vincular acesso de edição do Cliente Teste — aguardando identificação da conta pelo administrador
