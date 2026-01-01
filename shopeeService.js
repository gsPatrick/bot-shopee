/**
 * Shopee Video Downloader Service
 * Classe responsável por baixar vídeos da Shopee via svxtract.com
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ShopeeDownloader {
    constructor(outputDir = 'output_video') {
        this.outputDir = outputDir;
        this.URL_HOME = 'https://svxtract.com/';
        this.URL_DOWNLOAD = 'https://svxtract.com/function/download/downloader.php';
        
        this.HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://svxtract.com/',
            'Origin': 'https://svxtract.com'
        };

        // Padrões regex para capturar o token CSRF
        this.TOKEN_PATTERNS = [
            /csrfToken\s*=\s*["']([a-f0-9]+)["']/,
            /name="csrf_token" value="([a-f0-9]+)"/,
            /csrf_token\s*=\s*["']([a-f0-9]+)["']/
        ];

        this._ensureOutputDir();
    }

    _ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async _getCsrfToken(session) {
        try {
            const response = await session.get(this.URL_HOME);
            const html = response.data;

            for (const pattern of this.TOKEN_PATTERNS) {
                const match = html.match(pattern);
                if (match) {
                    return match[1];
                }
            }
            return null;
        } catch (error) {
            console.error('Erro ao obter CSRF token:', error.message);
            return null;
        }
    }

    _generateFilename() {
        const uniqueId = uuidv4().substring(0, 8);
        return `video_${uniqueId}.mp4`;
    }

    /**
     * Verifica se a URL é da Shopee
     */
    static isShopeeUrl(url) {
        if (!url) return false;
        const patterns = ['shopee.com', 'shp.ee', 'sv.shopee'];
        return patterns.some(pattern => url.toLowerCase().includes(pattern));
    }

    /**
     * Baixa o vídeo da Shopee e retorna o caminho do arquivo
     */
    async download(shopeeUrl) {
        // Cria instância axios com cookies (simulando sessão)
        const session = axios.create({
            headers: this.HEADERS,
            withCredentials: true,
            jar: true
        });

        // 1. Captura o token CSRF
        const csrfToken = await this._getCsrfToken(session);
        if (!csrfToken) {
            throw new Error('Não foi possível capturar o token CSRF.');
        }

        console.log(`   Token capturado: ${csrfToken.substring(0, 16)}...`);

        // 2. Requisição de download
        const params = new URLSearchParams({
            url: shopeeUrl,
            csrf_token: csrfToken,
            preview: '1'
        });

        const response = await session.get(`${this.URL_DOWNLOAD}?${params.toString()}`, {
            responseType: 'stream',
            headers: this.HEADERS
        });

        if (response.status !== 200) {
            throw new Error(`Erro na requisição: Status ${response.status}`);
        }

        // 3. Verifica se é realmente um vídeo
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            throw new Error('O serviço retornou HTML. O link pode ser inválido.');
        }

        // 4. Salva o arquivo
        const filename = this._generateFilename();
        const filepath = path.join(this.outputDir, filename);

        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(path.resolve(filepath)));
            writer.on('error', reject);
        });
    }
}

module.exports = ShopeeDownloader;
