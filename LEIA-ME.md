# Seleção de Estudantes · EEEP Venceslau Vieira Batista

Sistema interno (só com login) para a seleção de novos alunos: cadastro dos candidatos com leitura
das fotos dos documentos **no próprio aparelho** (nada é enviado para fora), notas do 6º ao 9º ano,
média aritmética de todas as disciplinas e classificação por curso (ampla concorrência, cota de bairro e PCD).

## Colocar no ar
1. Crie um banco MySQL na hospedagem do site da seleção.
2. No servidor, copie `includes/config.exemplo.php` para `includes/config.php` e preencha os dados do banco
   e uma `SEL_CHAVE_INSTALACAO` (frase longa). As tabelas são criadas sozinhas no primeiro acesso.
3. No GitHub (Settings › Secrets and variables › Actions) cadastre `FTP_SERVIDOR`, `FTP_USUARIO`, `FTP_SENHA`
   e `FTP_PASTA` (pasta do site no servidor, terminando em `/`). Cada envio para a branch `main` publica sozinho.
4. Abra o site: ele pede a chave de instalação e cria o administrador. Depois cadastre a equipe em **Usuários**
   e confira cursos, vagas e bairros em **Configurações**.
