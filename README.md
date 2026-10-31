# Rhema Capital

Vamos construir o MVP da Rhema Capital, um sistema pessoal de gestão financeira e patrimonial, para uso exclusivo do proprietário. Não é um sistema multiusuário nem um portal de clientes nesta fase.

Crie a fundação do aplicativo com identidade visual premium, minimalista e profissional, inspirada em consultoria patrimonial: azul-marinho (#0B1F3A), azul profundo (#12304F), dourado champagne (#C9A961) e off-white (#F5F1E8), com uso discreto do dourado.

Estruture a navegação lateral com: Dashboard, Movimentações, Contas, Patrimônio, Consórcios, Planejamento e Configurações.

Antes de implementar, proponha a arquitetura, o modelo de dados inicial, as políticas de segurança e a estratégia de autenticação. Use backend persistente com autenticação e políticas de acesso no banco. Nenhum dado financeiro pode ser acessível anonimamente ou por outro usuário. Não exponha chaves privilegiadas no frontend. Se utilizar Supabase, configure RLS nas tabelas com dados privados e valide a identidade e propriedade dos registros no servidor.

Prepare uma estrutura modular, responsiva e acessível, com componentes reutilizáveis e estados de carregamento, vazio e erro. Não use dados fictícios como se fossem dados reais. Não implemente ainda os módulos financeiros completos, nem integrações Open Finance, portal de clientes ou funcionalidades de equipe.

Primeiro apresente o plano técnico e as decisões que precisam de aprovação. Preserve a possibilidade de expansão futura, sem construir complexidade desnecessária.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c8d6cda1-32c9-441c-9e45-0c1953d0d5aa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
