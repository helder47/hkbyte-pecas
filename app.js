let scanner = null;
        let registros = JSON.parse(localStorage.getItem('pecas_atendimento')) || [];
        let lotesFechados = JSON.parse(localStorage.getItem('lotes_consolidados')) || [];
        atualizarContador();

        // Passo 1: RAT
        document.getElementById('rat').addEventListener('blur', function() {
            if(this.value.trim() !== '') {
                document.getElementById('codPeca').disabled = false;
                document.getElementById('codPeca').focus();
            }
        });

        // Passo 2: Código da Peça -> Libera a pergunta do Serial
        document.getElementById('codPeca').addEventListener('blur', function() {
            if(this.value.trim() !== '') {
                document.getElementById('temSerial').disabled = false;
                document.getElementById('temSerial').focus();
            }   
        });

        // Passo 3: Trata se tem ou não serial
        function tratarOpcaoSerial() {
            const opcao = document.getElementById('temSerial').value;
            const grupoSerial = document.getElementById('grupoSerial');
            
            // Limpa estado anterior do leitor se houver
            if(scanner) {
                scanner.clear().catch(e => console.log(e));
                scanner = null;
            }
            document.getElementById('reader').style.display = 'none';

            if(opcao === 'SIM') {
                grupoSerial.style.display = 'block';
                document.getElementById('reader').style.display = 'block';
                document.getElementById('labelSerial').innerText = "Escaneie o Número de Série:";
                
                if(!scanner) {
                    scanner = new Html5QrcodeScanner("reader", { 
                        fps: 10, 
                        qrbox: { width: 250, height: 120 } 
                    }, false);
                    scanner.render(onScanSuccess, onScanError);
                }
            } else if(opcao === 'NAO') {
                grupoSerial.style.display = 'block';
                document.getElementById('labelSerial').innerText = "Número de Série:";
                document.getElementById('serial').value = "SEM SERIAL";
                document.getElementById('btnSalvar').disabled = false;
            } else {
                grupoSerial.style.display = 'none';
            }
        }

        function onScanSuccess(text) {
            document.getElementById('serial').value = text;
            document.getElementById('btnSalvar').disabled = false;
            
            if(navigator.vibrate) navigator.vibrate(50);

            if (scanner) {
                scanner.clear().catch(error => console.error("Erro ao limpar leitor", error));
                scanner = null;
            }
        }

        function onScanError(errorMessage) {}

        function salvarRegistro() {
            const rat = document.getElementById('rat').value;
            const codPeca = document.getElementById('codPeca').value;
            const serial = document.getElementById('serial').value;

            if(!rat || !codPeca) {
                alert('Preencha a RAT e o Código da Peça!');
                return;
            }

            const novo = {
                id: Date.now() + Math.random(),
                data: new Date().toLocaleString(),
                rat: rat,
                codPeca: codPeca,
                serial: serial || "SEM SERIAL"
            };

            registros.push(novo);
            localStorage.setItem('pecas_atendimento', JSON.stringify(registros));
            atualizarContador();
            
            alert('Peça salva no histórico!');

            // Reseta o formulário para o próximo atendimento
            document.getElementById('rat').value = '';
            document.getElementById('codPeca').value = '';
            document.getElementById('codPeca').disabled = true;
            document.getElementById('temSerial').value = '';
            document.getElementById('temSerial').disabled = true;
            document.getElementById('serial').value = '';
            document.getElementById('grupoSerial').style.display = 'none';
            document.getElementById('reader').style.display = 'none';
            document.getElementById('btnSalvar').disabled = true;
            document.getElementById('rat').focus();
        }

        function atualizarContador() {
            document.getElementById('contador').innerText = registros.length;
        }

        function abrirModalLote() {
            if(registros.length === 0 && lotesFechados.length === 0) {
                alert('Não há peças acumuladas.');
                return;
            }

            const container = document.getElementById('listaPecasModal');
            container.innerHTML = '';

            if(registros.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:#666;">Todas as peças já foram distribuídas em lotes. Clique abaixo para gerar o termo final.</p>';
            } else {
                registros.forEach(r => {
                    container.innerHTML += `
                        <div class="item-check">
                            <input type="checkbox" value="${r.id}" id="chk_${r.id}">
                            <label for="chk_${r.id}" style="margin:0; display:inline; font-weight:normal;">
                                <b>RAT:</b> ${r.rat} | <b>Peça:</b> ${r.codPeca} | <b>Serial:</b> ${r.serial}
                            </label>
                        </div>
                    `;
                });
            }

            document.getElementById('modalLote').style.display = 'flex';
        }

        function fecharModalLote() {
            document.getElementById('modalLote').style.display = 'none';
        }

        function salvarLoteAtual() {
            const tecnico = document.getElementById('tecnico').value;
            const loteNum = document.getElementById('modalLoteNum').value;
            const tipoLote = document.getElementById('modalTipoLote').value;

            if(!tecnico) {
                alert('Preencha o Nome do Técnico no topo antes!');
                return;
            }
            if(!loteNum) {
                alert('Informe o Número do Lote!');
                return;
            }

            const checkboxes = document.querySelectorAll('#listaPecasModal input[type="checkbox"]:checked');
            if(checkboxes.length === 0) {
                alert('Selecione ao menos uma peça.');
                return;
            }

            const idsSelecionados = Array.from(checkboxes).map(chk => Number(chk.value));

            const pecasDoLote = registros.filter(r => idsSelecionados.includes(r.id));
            pecasDoLote.forEach(p => {
                lotesFechados.push({
                    data: p.data,
                    tecnico: tecnico,
                    lote: loteNum,
                    tipoLote: tipoLote,
                    codPeca: p.codPeca,
                    qtd: 1,
                    rat: p.rat,
                    serial: p.serial
                });
            });

            registros = registros.filter(r => !idsSelecionados.includes(r.id));
            
            localStorage.setItem('pecas_atendimento', JSON.stringify(registros));
            localStorage.setItem('lotes_consolidados', JSON.stringify(lotesFechados));
            
            atualizarContador();
            alert(`Lote ${loteNum} vinculado!`);
            
            document.getElementById('modalLoteNum').value = '';
            abrirModalLote();
        }

        function gerarDocumentoOFICIAL() {
            if(lotesFechados.length === 0) {
                alert('Vincule ao menos um lote antes de gerar o termo!');
                return;
            }

            const tecnico = lotesFechados[0].tecnico;
            
            let htmlDocumento = `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <title>CHECKLIST DE ENTREGA</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #000; font-size: 12px; }
                    h2 { text-align: center; font-size: 16px; margin-bottom: 20px; text-transform: uppercase; }
                    .header-doc { font-size: 14px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #000; padding: 6px; text-align: center; }
                    th { font-weight: bold; background: #f2f2f2; }
                    .text-left { text-align: left; }
                </style>
            </head>
            <body>
                <h2>CHECKLIST DE ENTREGA</h2>
                <div class="header-doc">
                    Eu, técnico <u>&nbsp;&nbsp;<b>${tecnico}</b>&nbsp;&nbsp;</u> declaro estar entregando as peças abaixo:
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>LOTE</th>
                            <th>CÓDIGO</th>
                            <th>TIPO DE LOTE</th>
                            <th>QTD</th>
                            <th>VALIDAÇÃO</th>
                            <th>OBSERVAÇÃO</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            lotesFechados.forEach(item => {
                htmlDocumento += `
                    <tr>
                        <td>${item.lote}</td>
                        <td>${item.codPeca}</td>
                        <td>${item.tipoLote}</td>
                        <td>${item.qtd}</td>
                        <td>SIM [ ] NÃO [ ]</td>
                        <td class="text-left">RAT: ${item.rat} | Serial: ${item.serial}</td>
                    </tr>
                `;
            });

            for(let i = lotesFechados.length; i < 15; i++) {
                htmlDocumento += `
                    <tr>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>USADO &nbsp; NOVA &nbsp; RMDF</td>
                        <td>&nbsp;</td>
                        <td>SIM [ ] NÃO [ ]</td>
                        <td>&nbsp;</td>
                    </tr>
                `;
            }

            htmlDocumento += `
                    </tbody>
                </table>
            </body>
            </html>
            `;

            const novaJanela = window.open('', '_blank');
            if (!novaJanela) {
                alert('Permita a abertura de janelas pop-up para gerar o termo.');
                return;
            }
            novaJanela.document.write(htmlDocumento);
            novaJanela.document.close();
            novaJanela.focus();
            novaJanela.print();
        }

        function limparDados() {
            if(window.confirm('Tem certeza que deseja apagar todo o histórico acumulado?')) {
                localStorage.clear();
                registros = [];
                lotesFechados = [];
                atualizarContador();
                alert('Histórico apagado com sucesso!');
            }
        }
