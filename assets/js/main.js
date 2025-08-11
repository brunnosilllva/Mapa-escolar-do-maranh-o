// assets/js/main.js
class CensoEscolarApp {
    constructor() {
        this.dadosGerais = [];
        this.dadosEscolas = [];
        this.geojsonData = null;
        this.municipioAtual = null;
        this.dataLoader = new DataLoader();
        this.mapUtils = new MapUtils();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDefaultLegend();
        this.updateStatus('Pronto! Clique em "Carregar Dados Padrão" para começar', 'info');
    }

    setupEventListeners() {
        document.getElementById('loadDefaultData').addEventListener('click', () => {
            this.loadDefaultData();
        });
        
        document.getElementById('excelFile').addEventListener('change', (e) => {
            this.handleCustomExcel(e);
        });
        
        document.getElementById('geojsonFile').addEventListener('change', (e) => {
            this.handleCustomGeojson(e);
        });
    }

    async loadDefaultData() {
        try {
            this.updateStatus('Carregando dados padrão...', 'loading');
            
            // Carregar dados da pasta data/
            const dadosGeraisPromise = this.dataLoader.loadExcelFromPath(
                'data/excel/dados_censo_escolar.xlsx', 'Dados Gerais'
            );
            
            const dadosEscolasPromise = this.dataLoader.loadExcelFromPath(
                'data/excel/dados_censo_escolar.xlsx', 'Análise - Tabela da lista'
            );
            
            const geojsonPromise = this.dataLoader.loadGeojsonFromPath(
                'data/geojson/maranhao_municipios.geojson'
            );

            const [dadosGerais, dadosEscolas, geojson] = await Promise.all([
                dadosGeraisPromise,
                dadosEscolasPromise, 
                geojsonPromise
            ]);

            this.dadosGerais = dadosGerais;
            this.dadosEscolas = dadosEscolas;
            this.geojsonData = geojson;

            console.log('Dados carregados:', {
                municipios: dadosGerais.length,
                escolas: dadosEscolas.length,
                features: geojson.features.length
            });

            this.renderMainMap();
            this.updateStatistics();
            this.updateStatus('Dados carregados com sucesso! Explore o mapa', 'success');

        } catch (error) {
            console.error('Erro ao carregar dados padrão:', error);
            this.updateStatus(`Erro: ${error.message}`, 'error');
        }
    }

    async handleCustomExcel(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.updateStatus('Carregando Excel personalizado...', 'loading');

            const dadosGerais = await this.dataLoader.loadExcelFile(file, 'Dados Gerais');
            const dadosEscolas = await this.dataLoader.loadExcelFile(file, 'Análise - Tabela da lista');

            this.dadosGerais = dadosGerais;
            this.dadosEscolas = dadosEscolas;

            if (this.geojsonData) {
                this.renderMainMap();
                this.updateStatistics();
                this.updateStatus('Excel personalizado carregado!', 'success');
            } else {
                this.updateStatus('Excel carregado. Carregue também o GeoJSON.', 'warning');
            }

        } catch (error) {
            console.error('Erro ao carregar Excel:', error);
            this.updateStatus(`Erro no Excel: ${error.message}`, 'error');
        }
    }

    async handleCustomGeojson(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.updateStatus('Carregando GeoJSON personalizado...', 'loading');
            
            const text = await file.text();
            this.geojsonData = JSON.parse(text);

            if (this.dadosGerais.length > 0) {
                this.renderMainMap();
                this.updateStatistics();
                this.updateStatus('GeoJSON personalizado carregado!', 'success');
            } else {
                this.updateStatus('GeoJSON carregado. Carregue também o Excel.', 'warning');
            }

        } catch (error) {
            console.error('Erro ao carregar GeoJSON:', error);
            this.updateStatus(`Erro no GeoJSON: ${error.message}`, 'error');
        }
    }

    renderMainMap() {
        document.getElementById('loading').style.display = 'none';
        
        this.mapUtils.renderMainMap(this.geojsonData, this.dadosGerais, {
            onMunicipioHover: (event, data, nome) => this.showTooltip(event, data, nome),
            onMunicipioClick: (data, nome) => this.showMunicipioDetails(data, nome)
        });

        this.loadDefaultLegend();
    }

    showTooltip(event, data, nomeMunicipio) {
        // Remover tooltip anterior
        d3.selectAll('.tooltip').remove();

        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        // Escapar aspas para evitar problemas no onclick
        const cdMunEscaped = (data.CD_MUN || data.Municípios || '').toString().replace(/'/g, "\\'");
        const nomeEscaped = (nomeMunicipio || data.Municípios || '').replace(/'/g, "\\'");

        const tooltipContent = `
            <h4>📍 ${nomeMunicipio || data.Municípios}</h4>
            <div class="tooltip-grid">
                <div class="tooltip-item">
                    <span>Estadual:</span>
                    <strong>${this.formatNumber(data.Estadual)}</strong>
                </div>
                <div class="tooltip-item">
                    <span>Federal:</span>
                    <strong>${this.formatNumber(data.Federal)}</strong>
                </div>
                <div class="tooltip-item">
                    <span>Municipal:</span>
                    <strong>${this.formatNumber(data.Municipal)}</strong>
                </div>
                <div class="tooltip-item">
                    <span>Privada:</span>
                    <strong>${this.formatNumber(data.Privada)}</strong>
                </div>
                <div class="tooltip-item">
                    <span>Total:</span>
                    <strong>${this.formatNumber(data['Total de Escolas por município'])}</strong>
                </div>
                <div class="tooltip-item">
                    <span>Até 50:</span>
                    <strong>${this.formatNumber(data['Até 50 matrículas de escolarização'])}</strong>
                </div>
                <div class="tooltip-item">
                    <span>51-200:</span>
                    <strong>${this.formatNumber(data['Entre 51 e 200 matrículas de escolarização'])}</strong>
                </div>
                <div class="tooltip-item">
                    <span>201-500:</span>
                    <strong>${this.formatNumber(data['Entre 201 e 500 matrículas de escolarização'])}</strong>
                </div>
                <div class="tooltip-item">
                    <span>501-1000:</span>
                    <strong>${this.formatNumber(data['Entre 501 e 1000 matrículas de escolarização'])}</strong>
                </div>
                <div class="tooltip-item">
                    <span>+1000:</span>
                    <strong>${this.formatNumber(data['Mais de 1000 matrículas de escolarização'])}</strong>
                </div>
            </div>
            <button class="btn-detalhes" onclick="window.App.showMunicipioDetailsFromTooltip('${cdMunEscaped}', '${nomeEscaped}')">
                👁️ Ver detalhes das escolas
            </button>
        `;

        tooltip.html(tooltipContent)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');

        // Mostrar com animação
        tooltip.transition()
            .duration(200)
            .style('opacity', 1);

        // Auto-esconder após um tempo ou ao mover o mouse para longe
        setTimeout(() => {
            const tooltipNode = tooltip.node();
            if (tooltipNode) {
                tooltipNode.addEventListener('mouseenter', () => {
                    tooltip.style('opacity', 1);
                });
                
                tooltipNode.addEventListener('mouseleave', () => {
                    tooltip.transition().duration(200).style('opacity', 0).remove();
                });
            }
        }, 100);
    }

    showMunicipioDetailsFromTooltip(cdMun, nomeMunicipio) {
        const municipioData = this.dadosGerais.find(d => 
            d.CD_MUN == cdMun || d.Municípios === nomeMunicipio
        );
        
        if (municipioData) {
            this.showMunicipioDetails(municipioData, nomeMunicipio);
        }
    }

    showMunicipioDetails(municipioData, nomeMunicipio) {
        this.municipioAtual = { data: municipioData, nome: nomeMunicipio };
        
        // Esconder tooltip
        d3.selectAll('.tooltip').style('opacity', 0);
        
        // Trocar páginas
        document.getElementById('main-page').style.display = 'none';
        document.getElementById('municipio-page').style.display = 'block';
        
        // Atualizar cabeçalho
        document.getElementById('municipio-titulo').textContent = `📍 ${nomeMunicipio}`;
        document.getElementById('municipio-subtitulo').textContent = 
            `${this.formatNumber(municipioData['Total de Escolas por município'])} escolas encontradas`;

        // Renderizar mapa das escolas
        this.mapUtils.renderEscolasMap(nomeMunicipio, this.dadosEscolas);
        
        // Atualizar estatísticas do município
        this.updateMunicipioStats(municipioData);
        this.updateEscolasLegend();
    }

    voltarMapa() {
        document.getElementById('municipio-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'block';
        this.mapUtils.clearPopups();
        this.municipioAtual = null;
    }

    updateStatistics() {
        if (this.dadosGerais.length === 0) return;

        const totalMunicipios = this.dadosGerais.length;
        const totalEscolas = this.dadosGerais.reduce((sum, d) => 
            sum + parseInt(d['Total de Escolas por município'] || 0), 0
        );
        
        const totalEstaduais = this.dadosGerais.reduce((sum, d) => 
            sum + parseInt(d.Estadual || 0), 0
        );
        
        const totalMunicipais = this.dadosGerais.reduce((sum, d) => 
            sum + parseInt(d.Municipal || 0), 0
        );
        
        const totalFederais = this.dadosGerais.reduce((sum, d) => 
            sum + parseInt(d.Federal || 0), 0
        );
        
        const totalPrivadas = this.dadosGerais.reduce((sum, d) => 
            sum + parseInt(d.Privada || 0), 0
        );

        const statsHtml = `
            <div class="stat-item">
                <span class="stat-label">Municípios</span>
                <span class="stat-value">${this.formatNumber(totalMunicipios)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total de Escolas</span>
                <span class="stat-value">${this.formatNumber(totalEscolas)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Estaduais</span>
                <span class="stat-value">${this.formatNumber(totalEstaduais)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Municipais</span>
                <span class="stat-value">${this.formatNumber(totalMunicipais)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Federais</span>
                <span class="stat-value">${this.formatNumber(totalFederais)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Privadas</span>
                <span class="stat-value">${this.formatNumber(totalPrivadas)}</span>
            </div>
        `;

        document.getElementById('stats-content').innerHTML = statsHtml;
    }

    updateMunicipioStats(data) {
        const statsHtml = `
            <div class="stat-item">
                <span class="stat-label">Total de Escolas</span>
                <span class="stat-value">${this.formatNumber(data['Total de Escolas por município'])}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Estaduais</span>
                <span class="stat-value">${this.formatNumber(data.Estadual)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Municipais</span>
                <span class="stat-value">${this.formatNumber(data.Municipal)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Federais</span>
                <span class="stat-value">${this.formatNumber(data.Federal)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Privadas</span>
                <span class="stat-value">${this.formatNumber(data.Privada)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Até 50 matrículas</span>
                <span class="stat-value">${this.formatNumber(data['Até 50 matrículas de escolarização'])}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">51-200 matrículas</span>
                <span class="stat-value">${this.formatNumber(data['Entre 51 e 200 matrículas de escolarização'])}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">201-500 matrículas</span>
                <span class="stat-value">${this.formatNumber(data['Entre 201 e 500 matrículas de escolarização'])}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">501-1000 matrículas</span>
                <span class="stat-value">${this.formatNumber(data['Entre 501 e 1000 matrículas de escolarização'])}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Mais de 1000</span>
                <span class="stat-value">${this.formatNumber(data['Mais de 1000 matrículas de escolarização'])}</span>
            </div>
        `;

        document.getElementById('municipio-stats-content').innerHTML = statsHtml;
    }

    loadDefaultLegend() {
        const legendHtml = `
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #1a472a;"></div>
                    <span>Mais de 100 escolas</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #2d5a3d;"></div>
                    <span>51 - 100 escolas</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #4caf50;"></div>
                    <span>26 - 50 escolas</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #81c784;"></div>
                    <span>11 - 25 escolas</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #c8e6c9;"></div>
                    <span>1 - 10 escolas</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #f5f5f5;"></div>
                    <span>Sem dados</span>
                </div>
            </div>
        `;

        document.getElementById('legend-content').innerHTML = legendHtml;
    }

    updateEscolasLegend() {
        const legendHtml = `
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #e74c3c;"></div>
                    <span>Estadual</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #3498db;"></div>
                    <span>Municipal</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #f39c12;"></div>
                    <span>Federal</span>
                </div>
            </div>
            <div class="legend-item">
                <div style="display: flex; align-items: center;">
                    <div class="legend-color" style="background: #9b59b6;"></div>
                    <span>Privada</span>
                </div>
            </div>
        `;

        document.getElementById('escolas-legend').innerHTML = legendHtml;
    }

    updateStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
    }

    formatNumber(num) {
        return num ? parseInt(num).toLocaleString('pt-BR') : '0';
    }

    // Métodos públicos para serem chamados do HTML
    hideTooltip() {
        d3.selectAll('.tooltip').transition().duration(200).style('opacity', 0);
    }

    showMunicipioDetailsFromTooltip(cdMun, nomeMunicipio) {
        const municipioData = this.dadosGerais.find(d => 
            d.CD_MUN == cdMun || d.Municípios === nomeMunicipio
        );
        
        if (municipioData) {
            this.showMunicipioDetails(municipioData, nomeMunicipio);
        }
    }

    // Método para encontrar dados do município (usado no tooltip)
    findMunicipioData(cdMun) {
        return this.dadosGerais.find(d => {
            return d.CD_MUN == cdMun || 
                   d['CD_MUN'] == cdMun ||
                   d.Municípios === cdMun ||
                   d.Municipios === cdMun;
        });
    }

    // Método para limpar dados e resetar aplicação
    clearData() {
        this.dadosGerais = [];
        this.dadosEscolas = [];
        this.geojsonData = null;
        this.municipioAtual = null;
        
        // Limpar interfaces
        d3.select('#map').selectAll('*').remove();
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('stats-content').innerHTML = '<div class="loading-animation"><p>Aguardando dados...</p></div>';
        document.getElementById('legend-content').innerHTML = '<div class="loading-animation"><p>Aguardando dados...</p></div>';
        
        // Voltar para página principal se estiver em detalhes
        if (document.getElementById('municipio-page').style.display !== 'none') {
            this.voltarMapa();
        }
        
        this.updateStatus('Dados limpos. Carregue novos arquivos.', 'info');
    }

    // Método para validar compatibilidade entre dados
    validateDataCompatibility() {
        if (!this.geojsonData || this.dadosGerais.length === 0) {
            return { isValid: false, message: 'Dados insuficientes para validação' };
        }

        const municipiosExcel = this.dadosGerais.length;
        const municipiosGeojson = this.geojsonData.features.length;
        
        let matched = 0;
        let unmatched = [];

        this.dadosGerais.forEach(municipio => {
            const found = this.geojsonData.features.find(feature => 
                feature.properties.CD_MUN == municipio.CD_MUN ||
                feature.properties.NM_MUN === municipio.Municípios
            );

            if (found) {
                matched++;
            } else {
                unmatched.push(municipio.Municípios || municipio.CD_MUN);
            }
        });

        const matchPercentage = (matched / municipiosExcel) * 100;

        return {
            isValid: matchPercentage > 50, // Consideramos válido se > 50% dos municípios têm match
            municipiosExcel,
            municipiosGeojson,
            matched,
            matchPercentage: matchPercentage.toFixed(1),
            unmatched: unmatched.slice(0, 5), // Primeiros 5 não encontrados
            message: `${matched}/${municipiosExcel} municípios encontrados (${matchPercentage.toFixed(1)}%)`
        };
    }

    // Método para exportar dados (funcionalidade futura)
    exportData(format = 'json') {
        if (this.dadosGerais.length === 0) {
            this.updateStatus('Nenhum dado para exportar', 'warning');
            return;
        }

        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                totalMunicipios: this.dadosGerais.length,
                totalEscolas: this.dadosEscolas.length
            },
            dadosGerais: this.dadosGerais,
            dadosEscolas: this.dadosEscolas
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `censo_escolar_maranhao_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.updateStatus('Dados exportados com sucesso!', 'success');
    }

    // Método para buscar município
    searchMunicipio(searchTerm) {
        if (!searchTerm || this.dadosGerais.length === 0) {
            return [];
        }

        const term = searchTerm.toLowerCase().trim();
        return this.dadosGerais.filter(municipio => 
            (municipio.Municípios || '').toLowerCase().includes(term) ||
            (municipio.CD_MUN || '').toString().includes(term)
        ).slice(0, 10); // Limitar a 10 resultados
    }

    // Método para obter estatísticas gerais
    getGeneralStatistics() {
        if (this.dadosGerais.length === 0) {
            return null;
        }

        const stats = {
            totalMunicipios: this.dadosGerais.length,
            totalEscolas: 0,
            escolasPorTipo: {
                estadual: 0,
                municipal: 0,
                federal: 0,
                privada: 0
            },
            escolasPorPorte: {
                ate50: 0,
                de51a200: 0,
                de201a500: 0,
                de501a1000: 0,
                mais1000: 0,
                semMatricula: 0
            }
        };

        this.dadosGerais.forEach(municipio => {
            stats.totalEscolas += parseInt(municipio['Total de Escolas por município'] || 0);
            stats.escolasPorTipo.estadual += parseInt(municipio.Estadual || 0);
            stats.escolasPorTipo.municipal += parseInt(municipio.Municipal || 0);
            stats.escolasPorTipo.federal += parseInt(municipio.Federal || 0);
            stats.escolasPorTipo.privada += parseInt(municipio.Privada || 0);
            
            stats.escolasPorPorte.ate50 += parseInt(municipio['Até 50 matrículas de escolarização'] || 0);
            stats.escolasPorPorte.de51a200 += parseInt(municipio['Entre 51 e 200 matrículas de escolarização'] || 0);
            stats.escolasPorPorte.de201a500 += parseInt(municipio['Entre 201 e 500 matrículas de escolarização'] || 0);
            stats.escolasPorPorte.de501a1000 += parseInt(municipio['Entre 501 e 1000 matrículas de escolarização'] || 0);
            stats.escolasPorPorte.mais1000 += parseInt(municipio['Mais de 1000 matrículas de escolarização'] || 0);
            stats.escolasPorPorte.semMatricula += parseInt(municipio['Escola sem matrícula de escolarização'] || 0);
        });

        return stats;
    }

    // Método para debug - logs detalhados
    debugInfo() {
        console.group('🔍 Debug Info - Censo Escolar App');
        console.log('📊 Dados Gerais:', this.dadosGerais.length, 'municípios');
        console.log('🏫 Dados Escolas:', this.dadosEscolas.length, 'escolas');
        console.log('🗺️ GeoJSON:', this.geojsonData ? this.geojsonData.features.length + ' features' : 'não carregado');
        console.log('📍 Município Atual:', this.municipioAtual);
        
        if (this.dadosGerais.length > 0) {
            console.log('📋 Primeiros dados gerais:', this.dadosGerais[0]);
        }
        
        if (this.dadosEscolas.length > 0) {
            console.log('🏫 Primeira escola:', this.dadosEscolas[0]);
        }
        
        if (this.geojsonData) {
            console.log('🗺️ Primeira feature:', this.geojsonData.features[0]);
        }

        const validation = this.validateDataCompatibility();
        console.log('✅ Validação:', validation);
        
        console.groupEnd();
    }
}

// Inicializar aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Criar instância global da aplicação
    window.App = new CensoEscolarApp();
    
    // Adicionar eventos globais
    window.addEventListener('beforeunload', function(e) {
        // Limpar dados se necessário
        if (window.App && typeof window.App.clearData === 'function') {
            // App.clearData(); // Descomente se quiser limpar dados ao sair
        }
    });

    // Event listener para teclas de atalho
    document.addEventListener('keydown', function(e) {
        // ESC para fechar popups
        if (e.key === 'Escape') {
            d3.selectAll('.tooltip').style('opacity', 0);
            d3.selectAll('.escola-popup').remove();
        }
        
        // Ctrl + D para debug info
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            if (window.App && typeof window.App.debugInfo === 'function') {
                window.App.debugInfo();
            }
        }
        
        // Ctrl + E para exportar dados
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            if (window.App && typeof window.App.exportData === 'function') {
                window.App.exportData();
            }
        }
    });
    
    console.log('🚀 Censo Escolar App inicializado com sucesso!');
    console.log('💡 Dicas:');
    console.log('   - Ctrl+D: Debug info');
    console.log('   - Ctrl+E: Exportar dados');
    console.log('   - ESC: Fechar popups');
});

// Métodos auxiliares globais para compatibilidade
window.showMunicipioDetails = function(municipioData, nomeMunicipio) {
    if (window.App && typeof window.App.showMunicipioDetails === 'function') {
        window.App.showMunicipioDetails(municipioData, nomeMunicipio);
    }
};

window.findMunicipioData = function(cdMun) {
    if (window.App && typeof window.App.findMunicipioData === 'function') {
        return window.App.findMunicipioData(cdMun);
    }
    return null;
};

window.voltarMapa = function() {
    if (window.App && typeof window.App.voltarMapa === 'function') {
        window.App.voltarMapa();
    }
};
