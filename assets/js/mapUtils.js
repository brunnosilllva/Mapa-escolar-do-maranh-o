// assets/js/mapUtils.js
class MapUtils {
    constructor() {
        this.width = 800;
        this.height = 600;
        this.colorScale = this.createColorScale();
        this.schoolColors = this.createSchoolColors();
        this.currentProjection = null;
        this.currentPath = null;
    }

    /**
     * Criar escala de cores para o mapa principal
     */
    createColorScale() {
        return d3.scaleThreshold()
            .domain([1, 11, 26, 51, 101])
            .range(['#f5f5f5', '#c8e6c9', '#81c784', '#4caf50', '#2d5a3d', '#1a472a']);
    }

    /**
     * Cores para tipos de escola
     */
    createSchoolColors() {
        return {
            'Estadual': '#e74c3c',
            'Municipal': '#3498db', 
            'Federal': '#f39c12',
            'Privada': '#9b59b6',
            'default': '#95a5a6'
        };
    }

    /**
     * Renderizar mapa principal do Maranhão
     * @param {Object} geojsonData - Dados GeoJSON
     * @param {Array} dadosGerais - Dados agregados por município
     * @param {Object} callbacks - Callbacks para eventos
     */
    renderMainMap(geojsonData, dadosGerais, callbacks) {
        console.log('Renderizando mapa principal...');

        const svg = d3.select('#map')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        // Limpar mapa anterior
        svg.selectAll('*').remove();

        // Configurar projeção
        this.currentProjection = d3.geoMercator()
            .fitSize([this.width, this.height], geojsonData);

        this.currentPath = d3.geoPath().projection(this.currentProjection);

        // Renderizar municípios
        const municipios = svg.selectAll('.municipio')
            .data(geojsonData.features)
            .enter().append('path')
            .attr('class', 'municipio')
            .attr('d', this.currentPath)
            .attr('fill', d => {
                const municipioData = this.findMunicipioData(d.properties.CD_MUN, dadosGerais);
                if (municipioData) {
                    const total = parseInt(municipioData['Total de Escolas por município'] || 0);
                    return this.colorScale(total);
                }
                return '#f5f5f5';
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .style('transition', 'all 0.3s ease');

        // Event listeners
        municipios
            .on('mouseover', (event, d) => {
                // Highlight município
                d3.select(event.currentTarget)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 2)
                    .style('filter', 'brightness(1.1)');

                // Mostrar tooltip
                const municipioData = this.findMunicipioData(d.properties.CD_MUN, dadosGerais);
                if (municipioData && callbacks.onMunicipioHover) {
                    callbacks.onMunicipioHover(event, municipioData, d.properties.NM_MUN);
                }
            })
            .on('mouseout', (event, d) => {
                // Remover highlight
                d3.select(event.currentTarget)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1)
                    .style('filter', 'brightness(1)');

                // Esconder tooltip após delay
                setTimeout(() => {
                    if (callbacks.onMunicipioHover) {
                        const tooltip = d3.select('.tooltip');
                        if (tooltip.node() && !tooltip.node().matches(':hover')) {
                            tooltip.transition().duration(200).style('opacity', 0);
                        }
                    }
                }, 100);
            })
            .on('mousemove', (event) => {
                // Atualizar posição do tooltip
                const tooltip = d3.select('.tooltip');
                if (tooltip.node()) {
                    tooltip
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                }
            })
            .on('click', (event, d) => {
                const municipioData = this.findMunicipioData(d.properties.CD_MUN, dadosGerais);
                if (municipioData && callbacks.onMunicipioClick) {
                    callbacks.onMunicipioClick(municipioData, d.properties.NM_MUN);
                }
            });

        console.log(`Mapa renderizado: ${geojsonData.features.length} municípios`);
    }

    /**
     * Renderizar mapa das escolas de um município
     * @param {string} nomeMunicipio - Nome do município
     * @param {Array} dadosEscolas - Dados das escolas
     */
    renderEscolasMap(nomeMunicipio, dadosEscolas) {
        console.log(`Renderizando escolas de ${nomeMunicipio}...`);

        const container = document.getElementById('escolas-map');
        container.innerHTML = '';

        // Filtrar escolas do município
        const escolasMunicipio = this.filterEscolasByMunicipio(nomeMunicipio, dadosEscolas);

        if (escolasMunicipio.length === 0) {
            this.showNoSchoolsMessage(container, nomeMunicipio);
            return;
        }

        // Filtrar escolas com coordenadas válidas
        const escolasComCoordenadas = escolasMunicipio.filter(escola => 
            this.hasValidCoordinates(escola)
        );

        if (escolasComCoordenadas.length === 0) {
            this.showNoCoordinatesMessage(container, nomeMunicipio, escolasMunicipio.length);
            return;
        }

        // Criar SVG
        const svg = d3.select('#escolas-map')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%');

        // Calcular bounds e escalas
        const { xScale, yScale, bounds } = this.calculateScales(escolasComCoordenadas, container);

        // Renderizar escolas
        this.renderSchoolMarkers(svg, escolasComCoordenadas, xScale, yScale);

        console.log(`${escolasComCoordenadas.length} escolas renderizadas em ${nomeMunicipio}`);
    }

    /**
     * Filtrar escolas por município
     */
    filterEscolasByMunicipio(nomeMunicipio, dadosEscolas) {
        return dadosEscolas.filter(escola => {
            const municipioEscola = escola.Município || escola.Municipio || '';
            return municipioEscola.toLowerCase().trim() === nomeMunicipio.toLowerCase().trim();
        });
    }

    /**
     * Verificar se escola tem coordenadas válidas
     */
    hasValidCoordinates(escola) {
        const lat = parseFloat(escola.Latitude);
        const lng = parseFloat(escola.Longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    }

    /**
     * Calcular escalas para posicionamento das escolas
     */
    calculateScales(escolas, container) {
        const lats = escolas.map(d => parseFloat(d.Latitude));
        const lngs = escolas.map(d => parseFloat(d.Longitude));

        const bounds = {
            minLng: d3.min(lngs),
            maxLng: d3.max(lngs),
            minLat: d3.min(lats),
            maxLat: d3.max(lats)
        };

        const containerRect = container.getBoundingClientRect();
        const mapWidth = containerRect.width || 600;
        const mapHeight = containerRect.height || 400;

        // Adicionar margem
        const margin = 50;

        const xScale = d3.scaleLinear()
            .domain([bounds.minLng, bounds.maxLng])
            .range([margin, mapWidth - margin]);

        const yScale = d3.scaleLinear()
            .domain([bounds.minLat, bounds.maxLat])
            .range([mapHeight - margin, margin]);

        return { xScale, yScale, bounds };
    }

    /**
     * Renderizar marcadores das escolas
     */
    renderSchoolMarkers(svg, escolas, xScale, yScale) {
        const markers = svg.selectAll('.escola-marker')
            .data(escolas)
            .enter().append('circle')
            .attr('class', 'escola-marker')
            .attr('cx', d => xScale(parseFloat(d.Longitude)))
            .attr('cy', d => yScale(parseFloat(d.Latitude)))
            .attr('r', 8)
            .attr('fill', d => this.getSchoolColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .style('transition', 'all 0.3s ease');

        // Event listeners para escolas
        markers
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .transition().duration(200)
                    .attr('r', 12)
                    .style('filter', 'brightness(1.2)');
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .transition().duration(200)
                    .attr('r', 8)
                    .style('filter', 'brightness(1)');
            })
            .on('click', (event, d) => {
                this.showSchoolPopup(event, d);
            });
    }

    /**
     * Obter cor da escola baseada na categoria
     */
    getSchoolColor(escola) {
        const categoria = escola['Categoria Administrativa'] || 
                         escola['Dependência Administrativa'] || '';
        
        return this.schoolColors[categoria] || this.schoolColors.default;
    }

    /**
     * Mostrar popup com informações da escola
     */
    showSchoolPopup(event, escolaData) {
        // Remover popup anterior
        this.clearPopups();

        const popup = d3.select('body').append('div')
            .attr('class', 'escola-popup fade-in')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px')
            .style('opacity', 0);

        const popupContent = this.generateSchoolPopupContent(escolaData);
        popup.html(popupContent);

        // Ajustar posição se sair da tela
        this.adjustPopupPosition(popup, event);

        // Mostrar popup com animação
        popup.transition()
            .duration(300)
            .style('opacity', 1);

        // Fechar popup ao clicar fora
        setTimeout(() => {
            d3.select('body').on('click.popup', (clickEvent) => {
                if (!popup.node().contains(clickEvent.target)) {
                    popup.transition()
                        .duration(200)
                        .style('opacity', 0)
                        .remove();
                    d3.select('body').on('click.popup', null);
                }
            });
        }, 100);
    }

    /**
     * Gerar conteúdo HTML do popup da escola
     */
    generateSchoolPopupContent(escolaData) {
        return `
            <h4>🏫 ${escolaData.Escola || 'Escola sem nome'}</h4>
            <div class="escola-info">
                <div class="escola-info-item">
                    <label>Código INEP</label>
                    <span>${escolaData['Código INEP'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Categoria Administrativa</label>
                    <span>${escolaData['Categoria Administrativa'] || escolaData['Dependência Administrativa'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Localização</label>
                    <span>${escolaData.Localização || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Endereço</label>
                    <span>${escolaData.Endereço || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Telefone</label>
                    <span>${escolaData.Telefone || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Porte da Escola</label>
                    <span>${escolaData['Porte da Escola'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Etapas e Modalidades</label>
                    <span>${escolaData['Etapas e Modalidade de Ensino Oferecidas'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Outras Ofertas</label>
                    <span>${escolaData['Outras Ofertas Educacionais'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Localidade Diferenciada</label>
                    <span>${escolaData['Localidade Diferenciada'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Categoria Escola Privada</label>
                    <span>${escolaData['Categoria Escola Privada'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Conveniada Poder Público</label>
                    <span>${escolaData['Conveniada Poder Público'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Regulamentação Conselho</label>
                    <span>${escolaData['Regulamentação pelo Conselho de Educação'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Restrição de Atendimento</label>
                    <span>${escolaData['Restrição de Atendimento'] || 'N/A'}</span>
                </div>
                <div class="escola-info-item">
                    <label>Coordenadas</label>
                    <span>Lat: ${escolaData.Latitude || 'N/A'}, Lng: ${escolaData.Longitude || 'N/A'}</span>
                </div>
            </div>
        `;
    }

    /**
     * Ajustar posição do popup para não sair da tela
     */
    adjustPopupPosition(popup, event) {
        const popupNode = popup.node();
        const rect = popupNode.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let left = event.pageX + 10;
        let top = event.pageY + 10;

        // Ajustar horizontalmente
        if (left + rect.width > windowWidth) {
            left = event.pageX - rect.width - 10;
        }

        // Ajustar verticalmente
        if (top + rect.height > windowHeight) {
            top = event.pageY - rect.height - 10;
        }

        popup.style('left', left + 'px')
             .style('top', top + 'px');
    }

    /**
     * Mostrar mensagem quando não há escolas
     */
    showNoSchoolsMessage(container, nomeMunicipio) {
        container.innerHTML = `
            <div class="loading-animation">
                <div style="text-align: center; color: #666;">
                    <h3>🏫 Nenhuma escola encontrada</h3>
                    <p>Não foram encontradas escolas para <strong>${nomeMunicipio}</strong></p>
                    <p>Verifique se o nome do município coincide nos arquivos Excel e GeoJSON</p>
                </div>
            </div>
        `;
    }

    /**
     * Mostrar mensagem quando não há coordenadas
     */
    showNoCoordinatesMessage(container, nomeMunicipio, totalEscolas) {
        container.innerHTML = `
            <div class="loading-animation">
                <div style="text-align: center; color: #666;">
                    <h3>📍 Coordenadas não disponíveis</h3>
                    <p><strong>${totalEscolas}</strong> escola(s) encontrada(s) em <strong>${nomeMunicipio}</strong></p>
                    <p>Porém nenhuma possui coordenadas válidas para visualização no mapa</p>
                    <p>Verifique as colunas Latitude e Longitude no arquivo Excel</p>
                </div>
            </div>
        `;
    }

    /**
     * Encontrar dados do município
     */
    findMunicipioData(cdMun, dadosGerais) {
        return dadosGerais.find(d => {
            // Tentar diferentes formas de match
            return d.CD_MUN == cdMun || 
                   d['CD_MUN'] == cdMun ||
                   d.Municípios === cdMun ||
                   d.Municipios === cdMun;
        });
    }

    /**
     * Limpar todos os popups e tooltips
     */
    clearPopups() {
        d3.selectAll('.tooltip').remove();
        d3.selectAll('.escola-popup').remove();
    }

    /**
     * Redimensionar mapa quando a janela muda de tamanho
     */
    resize() {
        // Re-renderizar mapas se necessário
        const mainMap = d3.select('#map');
        if (!mainMap.empty() && mainMap.selectAll('.municipio').size() > 0) {
            console.log('Redimensionando mapa principal...');
            // Lógica de redimensionamento se necessário
        }

        const escolasMap = d3.select('#escolas-map svg');
        if (!escolasMap.empty()) {
            console.log('Redimensionando mapa de escolas...');
            // Lógica de redimensionamento se necessário
        }
    }

    /**
     * Calcular estatísticas das escolas para um município
     */
    calculateSchoolStats(escolasMunicipio) {
        const stats = {
            total: escolasMunicipio.length,
            estadual: 0,
            municipal: 0,
            federal: 0,
            privada: 0,
            comCoordenadas: 0,
            semCoordenadas: 0
        };

        escolasMunicipio.forEach(escola => {
            const categoria = escola['Categoria Administrativa'] || 
                             escola['Dependência Administrativa'] || '';
            
            switch (categoria.toLowerCase()) {
                case 'estadual':
                    stats.estadual++;
                    break;
                case 'municipal':
                    stats.municipal++;
                    break;
                case 'federal':
                    stats.federal++;
                    break;
                case 'privada':
                    stats.privada++;
                    break;
            }

            if (this.hasValidCoordinates(escola)) {
                stats.comCoordenadas++;
            } else {
                stats.semCoordenadas++;
            }
        });

        return stats;
    }

    /**
     * Gerar bounds automáticos com margem
     */
    calculateBoundsWithMargin(coordinates, marginPercent = 0.1) {
        const lats = coordinates.map(c => c.lat);
        const lngs = coordinates.map(c => c.lng);

        const minLat = d3.min(lats);
        const maxLat = d3.max(lats);
        const minLng = d3.min(lngs);
        const maxLng = d3.max(lngs);

        const latMargin = (maxLat - minLat) * marginPercent;
        const lngMargin = (maxLng - minLng) * marginPercent;

        return {
            minLat: minLat - latMargin,
            maxLat: maxLat + latMargin,
            minLng: minLng - lngMargin,
            maxLng: maxLng + lngMargin
        };
    }

    /**
     * Exportar mapa como imagem (funcionalidade futura)
     */
    exportMap(mapId, filename = 'mapa.png') {
        // Implementação futura para export
        console.log(`Export do mapa ${mapId} como ${filename} - funcionalidade em desenvolvimento`);
    }
}

// Event listener para redimensionamento
window.addEventListener('resize', () => {
    if (window.mapUtils) {
        window.mapUtils.resize();
    }
});

// Exportar para uso global
window.MapUtils = MapUtils;
