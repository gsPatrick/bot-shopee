/**
 * Shopee Video Downloader Service
 * Classe responsável por baixar vídeos da Shopee via svxtract.com
 */

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ShopeeDownloader {
    constructor(outputDir = 'output_video') {
        this.outputDir = outputDir;
        this.URL_HOME = 'https://svxtract.com/';
        this.URL_DOWNLOAD = 'https://svxtract.com/function/download/downloader.php';

        this.HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
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

    _createSession() {
        // Cria um cookie jar para manter cookies entre requisições
        const jar = new CookieJar();
        const client = wrapper(axios.create({
            jar,
            headers: this.HEADERS,
            timeout: 30000
        }));
        return client;
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
        // Cria sessão com cookie jar
        const session = this._createSession();

        // 1. Acessa a página inicial para obter cookies e token
        console.log('   Acessando página inicial...');
        const csrfToken = await this._getCsrfToken(session);
        if (!csrfToken) {
            throw new Error('Não foi possível capturar o token CSRF.');
        }

        console.log(`   Token capturado: ${csrfToken.substring(0, 16)}...`);

        // 2. Requisição de download usando a mesma sessão (cookies)
        // Removemos preview=1 para tentar pegar a qualidade original
        const downloadUrl = `${this.URL_DOWNLOAD}?url=${encodeURIComponent(shopeeUrl)}&csrf_token=${csrfToken}`;

        console.log('   Baixando vídeo...');
        const response = await session.get(downloadUrl, {
            responseType: 'stream',
            headers: {
                ...this.HEADERS,
                'Referer': this.URL_HOME,
                'Origin': 'https://svxtract.com'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Erro na requisição: Status ${response.status}`);
        }

        // 3. Verifica se é realmente um vídeo
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            // Lê o corpo para ver o erro
            let errorBody = '';
            for await (const chunk of response.data) {
                errorBody += chunk.toString();
                if (errorBody.length > 500) break;
            }
            throw new Error(`O serviço retornou HTML: ${errorBody.substring(0, 200)}`);
        }

        // 4. Salva o arquivo
        const filename = this._generateFilename();
        const filepath = path.join(this.outputDir, filename);

        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`   Arquivo salvo: ${filepath}`);
                resolve(path.resolve(filepath));
            });
            writer.on('error', reject);
        });
    }
}

module.exports = ShopeeDownloader;
