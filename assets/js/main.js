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
        const tooltip = d3.select('body').selectAll('.tooltip').data([null]);
        const tooltipEnter = tooltip.enter().append('div').attr('class', 'tooltip');
        const tooltipMerge = tooltipEnter.merge(tooltip);

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
            <button class="btn-detalhes" onclick="App.showMunicipioDetailsFromTooltip('${data.CD_MUN || data.Municípios}', '${nomeMunicipio || data.Municípios}')">
                👁️ Ver detalhes das escolas
            </button>
        `;

        tooltipMerge.html(tooltipContent)
            .style('opacity', 1)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
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
                <span class="stat-value">${this.formatNumber(data.
