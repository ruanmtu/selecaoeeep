    </main>
    <footer class="sl-rodape">
        <div class="sl-rodape-onda" aria-hidden="true"></div>
        <div class="sl-rodape-grade">
            <div class="sl-rodape-marca">
                <img src="assets/img/logo-branca.png" alt="EEEP Venceslau Vieira Batista" width="1400" height="451" loading="lazy">
                <p>Seleção de Estudantes <?= sel_ano() ?>. Sistema interno de uso da equipe da seleção.</p>
            </div>
            <div class="sl-rodape-col">
                <h3>Seleção <?= sel_ano() ?></h3>
                <a href="candidatos.php"><span class="sl-rd-i"><i class="bi bi-people"></i></span>Candidatos</a>
                <a href="candidato.php"><span class="sl-rd-i"><i class="bi bi-person-plus"></i></span>Novo candidato</a>
                <a href="classificacao.php"><span class="sl-rd-i"><i class="bi bi-trophy"></i></span>Classificação</a>
            </div>
            <div class="sl-rodape-col">
                <h3>Escola</h3>
                <a href="https://eeepvenceslau.com.br" target="_blank" rel="noopener"><span class="sl-rd-i"><i class="bi bi-globe2"></i></span>Site da escola</a>
                <span class="sl-rd-linha"><span class="sl-rd-i"><i class="bi bi-geo-alt"></i></span>Boa Viagem · Ceará</span>
            </div>
        </div>
        <div class="sl-rodape-base">© <?= date('Y') ?> EEEP Venceslau Vieira Batista · Seleção de Estudantes <?= sel_ano() ?> · uso interno</div>
    </footer>
    </div>
</div>
<script src="assets/vendor/bootstrap/bootstrap.bundle.min.js"></script>
<?= $scripts ?? '' ?>
</body>
</html>
