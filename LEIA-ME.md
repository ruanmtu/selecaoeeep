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

## Leitura dos documentos (no aparelho, sem serviços externos)
Tudo roda no navegador do professor, sem custo e sem limite:
- `assets/js/leitura.js` — o leitor: Tesseract em português, carregado assim que a tela do candidato abre;
  2 leitores em paralelo em aparelhos bons. PDF com texto não passa no OCR (o texto sai direto do arquivo).
- `assets/js/imagem.js` — tratamento da foto: endireita (até 20°), contraste e preto e branco adaptativo.
- `assets/js/interpretar.js` — as regras de cada documento ("onde fica cada informação"):
  RG antigo, CIN (inclusive a zona MRZ do verso), certidão e comprovante de residência (Enel, Cagece,
  internet, declaração). No comprovante, pega o titular e o endereço do cliente, nunca o da empresa,
  e marca a cota de bairro mesmo com 1 letra lida errada.

Ordem da leitura: 1ª passada em cinza; se faltar campo, 2ª em preto e branco adaptativo; se a confiança vier
muito baixa (foto deitada ou de cabeça para baixo), tenta girando 90°/180° e fica com o giro de maior confiança.
O arquivo `ler.php` só existe para desativar a versão antiga no servidor (a publicação não apaga arquivos).
