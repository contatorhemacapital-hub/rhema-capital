# Rhema Capital — Plano técnico do MVP (fundação)

## Objetivo
Fundação de um sistema pessoal (um único proprietário) de gestão financeira e patrimonial: identidade visual, navegação, autenticação, banco protegido e esqueleto dos módulos com estados de carregamento, vazio e erro. Sem dados fictícios, sem módulos financeiros completos, sem Open Finance, portal de clientes ou equipe.

## Identidade visual
- Paleta: marinho #0B1F3A (barra lateral, títulos), azul profundo #12304F (superfícies escuras, botão principal), champagne #C9A961 (só detalhes: item ativo do menu, filetes, foco), off-white #F5F1E8 (fundo).
- Tipografia: Cormorant Garamond (títulos, tom de consultoria patrimonial) + Manrope (texto e números, com algarismos tabulares).
- Tudo definido como tokens de design (oklch) num só lugar; nenhuma cor solta nos componentes.
- Interface em português (pt-BR), moeda BRL, datas dd/mm/aaaa.

## Navegação
Menu lateral recolhível (vira gaveta no celular): Dashboard, Movimentações, Contas, Patrimônio, Consórcios, Planejamento, Configurações. Cabeçalho com nome do módulo e menu da conta (sair).
Cada módulo nesta fase mostra cabeçalho + estado vazio honesto ("Nenhuma conta cadastrada ainda"), sem números inventados. O Dashboard mostra cartões vazios ("—") até existirem dados.

## Arquitetura
- TanStack Start (React) com rotas por arquivo; páginas privadas dentro de uma área protegida que exige sessão.
- Lovable Cloud como backend: banco Postgres, autenticação e políticas de acesso no banco (RLS).
- Leituras/escritas via funções de servidor autenticadas, que validam o token do usuário e operam com as permissões dele (RLS sempre ativa). Chave privilegiada nunca no navegador; não será usada nesta fase.
- Estrutura modular: `src/features/<modulo>/` (consultas, componentes, tipos) + `src/components/` compartilhados (PageHeader, EmptyState, ErrorState, LoadingSkeleton, StatCard, Money).

## Autenticação (decisão para aprovar)
- E-mail e senha, com recuperação de senha (página /reset-password).
- Uso exclusivo do proprietário: após o proprietário criar a conta, o cadastro público é desativado. Além disso, uma tabela `app_owner` com no máximo uma linha registra o dono; as políticas do banco só liberam dados ao dono (dupla barreira: mesmo que alguém crie conta, não vê nada).
- Sessão expira normalmente; botão "Sair" limpa dados em cache.

## Modelo de dados inicial (apenas o essencial)
Todas as tabelas: `id`, `owner_id` (→ usuário, padrão = usuário logado), `created_at`, `updated_at`, valores em `numeric(18,2)`, moeda `char(3)` padrão BRL.
- `app_owner` — usuário proprietário (linha única).
- `profiles` — nome de exibição, preferências (moeda, idioma).
- `accounts` — contas: nome, instituição, tipo (corrente, poupança, investimento, cartão, carteira), saldo inicial, ativa.
- `categories` — categorias de receita/despesa (hierarquia simples via `parent_id`).
- `transactions` — movimentações: conta, categoria, tipo (receita/despesa/transferência), valor, data, descrição.
- `assets` — patrimônio: tipo (imóvel, veículo, investimento, participação, outro), nome, valor estimado, data de avaliação.
- `consortia` — consórcios: administradora, grupo/cota, valor da carta, parcelas totais/pagas, situação.
- `goals` — planejamento: nome, valor alvo, prazo.

Nesta fase as telas não terão formulários completos; as tabelas existem para a expansão seguinte. (Alternativa: criar só `app_owner`, `profiles` e `accounts` agora — ver decisões.)

## Segurança
- RLS ativa em todas as tabelas; nenhum acesso para usuários anônimos (sem GRANT para `anon`).
- Políticas: SELECT/INSERT/UPDATE/DELETE apenas quando `owner_id = auth.uid()` **e** o usuário é o dono registrado (função `is_owner()` security definer).
- INSERT com `owner_id` forçado pelo banco (padrão `auth.uid()` + verificação na política), impedindo gravar em nome de outro.
- Chaves estrangeiras validadas por propriedade (ex.: movimentação só pode apontar para conta do mesmo dono).
- Funções de servidor validam o usuário a cada chamada; nenhum endpoint público com dados.
- Validação de entrada com Zod no servidor.

## Qualidade
- Acessível: navegação por teclado, foco visível em champagne, rótulos ARIA, contraste AA.
- Responsivo: menu em gaveta abaixo de 768px.
- Testes pequenos para regras de formatação de moeda e do guarda de acesso.

## Decisões que precisam da sua aprovação
1. Login por e-mail e senha com cadastro fechado após a sua conta (ou prefere login com Google?).
2. Criar já todas as tabelas listadas, ou só as básicas (dono, perfil, contas) e o resto quando cada módulo for construído?
3. Fontes: Cormorant Garamond + Manrope está de acordo?
4. Moeda única BRL por enquanto, com campo de moeda preparado para o futuro?
