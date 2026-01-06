const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ShopeeDownloaderNew {
    constructor(outputDir = 'output_video') {
        this.API_URL = 'https://svdown.tech/api/resolve';
        this.outputDir = outputDir;

        // Garante que o diretório de saída existe
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    static isShopeeUrl(url) {
        return url.includes('shopee.com.br') || url.includes('shp.ee') || url.includes('sv.shopee.com.br');
    }

    /**
     * Baixa o vídeo usando a nova API svdown.tech
     * @param {string} shopeeUrl 
     * @returns {Promise<string>} Caminho do arquivo baixado
     */
    async download(shopeeUrl) {
        try {
            console.log(`🚀 Iniciando download via SVDown: ${shopeeUrl}`);

            // 1. Resolve os dados do vídeo na API
            const { data } = await axios.post(this.API_URL, {
                url: shopeeUrl
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://svdown.tech',
                    'Referer': 'https://svdown.tech/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            console.log('   Dados da API recebidos:', data && data.title ? 'Sucesso' : 'Falha');

            if (!data || !data.video || !data.video.url) {
                console.error('   API Response:', data);
                throw new Error('API não retornou a URL do vídeo.');
            }

            const videoUrl = data.video.url;
            const title = data.title || 'video_shopee';
            const quality = data.video.qualityLabel || 'unknown';

            console.log(`   URL do Vídeo: ${videoUrl}`);
            console.log(`   Qualidade: ${quality}`);

            // 2. Baixa o arquivo de vídeo real
            const filename = `video_${uuidv4().split('-')[0]}.mp4`;
            const filepath = path.join(this.outputDir, filename);

            const writer = fs.createWriteStream(filepath);

            const videoResponse = await axios({
                url: videoUrl,
                method: 'GET',
                responseType: 'stream'
            });

            videoResponse.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`   Arquivo salvo: ${filepath}`);
                    resolve(filepath);
                });
                writer.on('error', (err) => {
                    console.error('   Erro ao salvar arquivo:', err);
                    reject(err);
                });
            });

        } catch (error) {
            console.error('❌ Erro no SVDown:', error.message);
            if (error.response) {
                console.error('   Detalhes:', error.response.data);
            }
            throw new Error('Falha ao baixar vídeo pela nova API.');
        }
    }
}

module.exports = ShopeeDownloaderNew;
