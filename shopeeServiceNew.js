const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ShopeeDownloaderNew {
    constructor(outputDir = 'output_video') {
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
     * Baixa o vídeo fazendo scrape direto da página da Shopee (sv.shopee.com.br)
     * Isso bypassa APIs de terceiros e pega o link original (vod.susercontent.com)
     */
    async download(shopeeUrl) {
        try {
            console.log(`🚀 Iniciando download direto: ${shopeeUrl}`);

            // 1. Acessa a página da Shopee Video para pegar o HTML
            const response = await axios.get(shopeeUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                }
            });

            const html = response.data;

            // 2. Procura por links de vídeo (.mp4) no HTML
            // Regex para pegar URLs que terminam com .mp4
            const mp4Matches = html.match(/https?:\/\/[^"']+\.mp4/g);

            if (!mp4Matches || mp4Matches.length === 0) {
                console.error('   Nenhum arquivo .mp4 encontrado na página.');
                throw new Error('Não foi possível extrair o link do vídeo da página.');
            }

            // Pega o primeiro match (geralmente é o melhor)
            let videoUrl = mp4Matches[0];

            // Tenta priorizar URLs que pareçam "clean" (sem muitos sufixos numéricos), se houver multiplos
            // Ex: .../video.mp4 vs .../video.12345.mp4
            if (mp4Matches.length > 1) {
                const cleanMatch = mp4Matches.find(m => !m.match(/\.\d+\.\d+\.mp4$/));
                if (cleanMatch) videoUrl = cleanMatch;
            }

            console.log(`   URL do Vídeo Encontrada: ${videoUrl}`);

            // 3. Baixa o arquivo de vídeo
            const filename = `video_${uuidv4().split('-')[0]}.mp4`;
            const filepath = path.join(this.outputDir, filename);
            const writer = fs.createWriteStream(filepath);

            const videoResponse = await axios({
                url: videoUrl,
                method: 'GET',
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
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
            console.error('❌ Erro no Download Direto:', error.message);
            throw new Error('Falha ao baixar vídeo diretamente da Shopee.');
        }
    }
}

module.exports = ShopeeDownloaderNew;
