// assets/js/dataLoader.js
class DataLoader {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Carrega arquivo Excel de um caminho específico
     * @param {string} filePath - Caminho para o arquivo Excel
     * @param {string} sheetName - Nome da aba a ser carregada
     * @returns {Promise<Array>} - Array com os dados da planilha
     */
    async loadExcelFromPath(filePath, sheetName) {
        const cacheKey = `${filePath}_${sheetName}`;
        
        // Verificar cache primeiro
        if (this.cache.has(cacheKey)) {
            console.log(`Dados de ${sheetName} carregados do cache`);
            return this.cache.get(cacheKey);
        }

        try {
            console.log(`Carregando ${sheetName} de ${filePath}...`);
            
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`Arquivo não encontrado: ${filePath} (${response.status})`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { 
                type: 'array',
                cellStyles: true,
                cellFormulas: true,
                cellDates: true
            });
            
            if (!workbook.Sheets[sheetName]) {
                const availableSheets = Object.keys(workbook.Sheets);
                throw new Error(
                    `Aba "${sheetName}" não encontrada. Abas disponíveis: ${availableSheets.join(', ')}`
                );
            }
            
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { 
                raw: false,
                defval: '' // Valor padrão para células vazias
            });

            // Limpar dados
            const cleanData = this.cleanExcelData(data);
            
            // Adicionar ao cache
            this.cache.set(cacheKey, cleanData);
            
            console.log(`${sheetName} carregado: ${cleanData.length} registros`);
            return cleanData;

        } catch (error) {
            console.error(`Erro ao carregar ${filePath}:`, error);
            throw new Error(`Erro ao carregar ${sheetName}: ${error.message}`);
        }
    }

    /**
     * Carrega arquivo GeoJSON de um caminho específico
     * @param {string} filePath - Caminho para o arquivo GeoJSON
     * @returns {Promise<Object>} - Objeto GeoJSON
     */
    async loadGeojsonFromPath(filePath) {
        // Verificar cache primeiro
        if (this.cache.has(filePath)) {
            console.log(`GeoJSON carregado do cache`);
            return this.cache.get(filePath);
        }

        try {
            console.log(`Carregando GeoJSON de ${filePath}...`);
            
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`Arquivo não encontrado: ${filePath} (${response.status})`);
            }

            const geojsonData = await response.json();
            
            // Validar estrutura GeoJSON
            this.validateGeojson(geojsonData);
            
            // Adicionar ao cache
            this.cache.set(filePath, geojsonData);
            
            console.log(`GeoJSON carregado: ${geojsonData.features.length} features`);
            return geojsonData;

        } catch (error) {
            console.error(`Erro ao carregar ${filePath}:`, error);
            throw new Error(`Erro ao carregar GeoJSON: ${error.message}`);
        }
    }

    /**
     * Carrega arquivo Excel do input do usuário
     * @param {File} file - Arquivo selecionado pelo usuário
     * @param {string} sheetName - Nome da aba a ser carregada
     * @returns {Promise<Array>} - Array com os dados da planilha
     */
    async loadExcelFile(file, sheetName) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('Nenhum arquivo selecionado'));
                return;
            }

            if (!file.name.match(/\.(xlsx|xls)$/i)) {
                reject(new Error('Formato de arquivo inválido. Use .xlsx ou .xls'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    console.log(`Processando arquivo ${file.name}, aba ${sheetName}...`);
                    
                    const workbook = XLSX.read(e.target.result, { 
                        type: 'array',
                        cellStyles: true,
                        cellFormulas: true,
                        cellDates: true
                    });
                    
                    if (!workbook.Sheets[sheetName]) {
                        const availableSheets = Object.keys(workbook.Sheets);
                        reject(new Error(
                            `Aba "${sheetName}" não encontrada em ${file.name}. Abas disponíveis: ${availableSheets.join(', ')}`
                        ));
                        return;
                    }
                    
                    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { 
                        raw: false,
                        defval: ''
                    });

                    // Limpar dados
                    const cleanData = this.cleanExcelData(data);
                    
                    console.log(`${sheetName} processado: ${cleanData.length} registros`);
                    resolve(cleanData);
                    
                } catch (error) {
                    console.error('Erro ao processar Excel:', error);
                    reject(new Error(`Erro ao processar ${file.name}: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error(`Erro ao ler arquivo ${file.name}`));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Carrega arquivo GeoJSON do input do usuário
     * @param {File} file - Arquivo selecionado pelo usuário
     * @returns {Promise<Object>} - Objeto GeoJSON
     */
    async loadGeojsonFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('Nenhum arquivo selecionado'));
                return;
            }

            if (!file.name.match(/\.(geojson|json)$/i)) {
                reject(new Error('Formato de arquivo inválido. Use .geojson ou .json'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    console.log(`Processando arquivo ${file.name}...`);
                    
                    const geojsonData = JSON.parse(e.target.result);
                    
                    // Validar estrutura GeoJSON
                    this.validateGeojson(geojsonData);
                    
                    console.log(`GeoJSON processado: ${geojsonData.features.length} features`);
                    resolve(geojsonData);
                    
                } catch (error) {
                    console.error('Erro ao processar GeoJSON:', error);
                    reject(new Error(`Erro ao processar ${file.name}: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error(`Erro ao ler arquivo ${file.name}`));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Limpa e normaliza dados do Excel
     * @param {Array} data - Dados brutos do Excel
     * @returns {Array} - Dados limpos
     */
    cleanExcelData(data) {
        return data.map(row => {
            const cleanRow = {};
            
            Object.keys(row).forEach(key => {
                // Limpar chaves (remover espaços extras)
                const cleanKey = key.trim();
                let value = row[key];
                
                // Limpar valores
                if (typeof value === 'string') {
                    value = value.trim();
                    
                    // Tentar converter números
                    if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
                        value = parseFloat(value);
                    }
                }
                
                cleanRow[cleanKey] = value;
            });
            
            return cleanRow;
        }).filter(row => {
            // Remover linhas completamente vazias
            return Object.values(row).some(value => 
                value !== null && value !== undefined && value !== ''
            );
        });
    }

    /**
     * Valida estrutura básica do GeoJSON
     * @param {Object} geojsonData - Dados do GeoJSON
     */
    validateGeojson(geojsonData) {
        if (!geojsonData || typeof geojsonData !== 'object') {
            throw new Error('Arquivo GeoJSON inválido: não é um objeto JSON válido');
        }

        if (geojsonData.type !== 'FeatureCollection') {
            throw new Error('GeoJSON deve ser do tipo "FeatureCollection"');
        }

        if (!Array.isArray(geojsonData.features)) {
            throw new Error('GeoJSON deve conter um array "features"');
        }

        if (geojsonData.features.length === 0) {
            throw new Error('GeoJSON não contém nenhuma feature');
        }

        // Verificar se possui propriedade CD_MUN nas features
        const hasCD_MUN = geojsonData.features.some(feature => 
            feature.properties && feature.properties.CD_MUN
        );

        if (!hasCD_MUN) {
            console.warn('Aviso: Nenhuma feature possui propriedade "CD_MUN". Verifique a compatibilidade com os dados do Excel.');
        }

        console.log('GeoJSON validado com sucesso');
    }

    /**
     * Limpar cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Cache limpo');
    }

    /**
     * Obter informações do cache
     */
    getCacheInfo() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Verificar compatibilidade entre dados Excel e GeoJSON
     * @param {Array} dadosGerais - Dados da aba "Dados Gerais"
     * @param {Object} geojsonData - Dados do GeoJSON
     * @returns {Object} - Relatório de compatibilidade
     */
    checkCompatibility(dadosGerais, geojsonData) {
        const report = {
            totalMunicipiosExcel: dadosGerais.length,
            totalMunicipiosGeojson: geojsonData.features.length,
            matched: 0,
            unmatched: [],
            missing: []
        };

        // Verificar quais municípios do Excel têm correspondência no GeoJSON
        dadosGerais.forEach(municipio => {
            const cdMun = municipio.CD_MUN || municipio.Municípios;
            const found = geojsonData.features.find(feature => 
                feature.properties.CD_MUN == cdMun ||
                feature.properties.NM_MUN === municipio.Municípios
            );

            if (found) {
                report.matched++;
            } else {
                report.unmatched.push({
                    nome: municipio.Municípios,
                    cd_mun: municipio.CD_MUN
                });
            }
        });

        // Verificar municípios do GeoJSON sem dados no Excel
        geojsonData.features.forEach(feature => {
            const cdMun = feature.properties.CD_MUN;
            const nome = feature.properties.NM_MUN;
            
            const found = dadosGerais.find(municipio =>
                municipio.CD_MUN == cdMun ||
                municipio.Municípios === nome
            );

            if (!found) {
                report.missing.push({
                    nome: nome,
                    cd_mun: cdMun
                });
            }
        });

        console.log('Relatório de compatibilidade:', report);
        return report;
    }
}

// Exportar para uso global
window.DataLoader = DataLoader;
