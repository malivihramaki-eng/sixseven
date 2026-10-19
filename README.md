# SixSeven

Site de tarefas diárias (segunda a sexta) com carteira virtual e loja.

- `index.html`: o site inteiro (HTML, CSS e JS num arquivo só). Hospedado no GitHub Pages.
- `Code.gs`: backend no Google Apps Script. Banco de dados = Google Sheets; fotos e áudios = pasta "SixSeven" no Drive.

## 1. Backend (Google)

1. Crie uma planilha no Google Sheets e copie o ID da URL (entre `/d/` e `/edit`).
2. Em https://script.google.com crie um projeto, cole o `Code.gs` e troque `SHEET_ID`.
3. Rode a função `setup` uma vez e autorize as permissões.
4. Implantar > Nova implantação > Aplicativo da Web:
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
5. Copie a URL que termina em `/exec`.
6. Se alterar o `Code.gs` depois, faça Implantar > Gerenciar implantações > editar > nova versão (a URL continua a mesma).

## 2. Site (GitHub Pages)

1. Em `index.html`, cole a URL do passo anterior em `const API = '...'`.
2. Crie um repositório no GitHub e envie o `index.html` (o `Code.gs` e este README podem ir junto; não têm segredos, só o ID da planilha).
3. Settings > Pages > Source: branch `main`, pasta `/ (root)`.
4. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Dicas

- No celular, abra o link e use "Adicionar à tela inicial" para virar um app.
- Se o repositório for público, qualquer pessoa vê a URL do Apps Script e o ID da planilha. Use um repositório privado (Pages privado exige plano pago) ou aceite que a proteção é a senha de cada conta.
- Contas iniciais: Cesar (azul), Arthur (verde), Ericky (branco, PIN `1313`).
- Recompensa por atividade aprovada: constante `RECOMPENSA` no `Code.gs`.
