# Seleção de Estudantes · EEEP Venceslau Vieira Batista

Sistema interno (só com login) para a seleção de novos alunos: cadastro dos candidatos com leitura
automática das fotos e PDFs dos documentos (IA em planos gratuitos, ou no próprio aparelho), notas do 6º ao 9º ano,
média aritmética de todas as disciplinas e classificação por curso (ampla concorrência, cota de bairro e PCD).

## Colocar no ar
1. Crie um banco MySQL na hospedagem do site da seleção.
2. No servidor, copie `includes/config.exemplo.php` para `includes/config.php` e preencha os dados do banco
   e uma `SEL_CHAVE_INSTALACAO` (frase longa). As tabelas são criadas sozinhas no primeiro acesso.
3. No GitHub (Settings › Secrets and variables › Actions) cadastre `FTP_SERVIDOR`, `FTP_USUARIO`, `FTP_SENHA`
   e `FTP_PASTA` (pasta do site no servidor, terminando em `/`). Cada envio para a branch `main` publica sozinho.
4. Abra o site: ele pede a chave de instalação e cria o administrador. Depois cadastre a equipe em **Usuários**
   e confira cursos, vagas e bairros em **Configurações**.

## Leitura automática dos documentos (custo zero)
Só serviços com plano **gratuito e sem cartão**, em cascata (`ler.php`):
1. **PDF com texto** (ex.: histórico do SIGE): o texto sai direto do arquivo, no aparelho.
2. **Gemini** (Google) — chave em aistudio.google.com/apikey → `GEMINI_API_KEY` no `config.php`.
3. **Groq** (reserva) — chave em console.groq.com/keys → `GROQ_API_KEY` no `config.php`.
   Fotos usam um modelo de visão (`GROQ_MODELO`, padrão `qwen/qwen3.8-27b`); PDF com texto usa
   `GROQ_MODELO_TEXTO` (padrão `openai/gpt-oss-120b`), que tem cota separada.
4. Se nenhum conseguir: botão **Ler neste aparelho** (OCR no navegador) ou digitação.

Quando um serviço estoura o limite (por minuto ou do dia), ele fica **em pausa** e as próximas leituras vão
direto para o outro. Em **Configurações** aparecem a situação de cada serviço, as leituras do dia e o botão de teste.
PDF escaneado é convertido em fotos no próprio aparelho antes de ser enviado.

