const axios = require('axios');

const WATERMARKED_URL = 'https://down-bs-br.vod.susercontent.com/api/v4/11110124/mms/br-11110124-6v65g-mhgud0typ0cid5.16003551764038920.2263.mp4';
const CLEAN_TARGET_FROM_LOG = 'https://down-ws-br.vod.susercontent.com/api/v4/11110124/mms/br-11110124-6v65g-mhgud0typ0cid5.mp4';

async function checkUrl(url, label) {
    console.log(`\nTestando: ${label}`);
    console.log(`URL: ${url}`);
    try {
        const res = await axios.head(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            validateStatus: () => true
        });
        console.log(`Status: ${res.status}`);
        if (res.status === 200) {
            console.log(`Content-Length: ${res.headers['content-length']}`);
            console.log(`Content-Type: ${res.headers['content-type']}`);
        }
    } catch (e) {
        console.log(`Erro: ${e.message}`);
    }
}

async function run() {
    // 1. Tentar URL limpa mantendo o mesmo dominio (bs-br)
    // Regex para remover os sufixos numéricos antes do .mp4
    const cleanUrlBS = WATERMARKED_URL.replace(/\.\d+\.\d+\.mp4$/, '.mp4');
    await checkUrl(cleanUrlBS, '1. Clean URL (Same Domain - bs-br)');

    // 2. Tentar URL limpa trocando para ws-br (como visto no log do svdown)
    const cleanUrlWS = cleanUrlBS.replace('down-bs-br', 'down-ws-br');
    await checkUrl(cleanUrlWS, '2. Clean URL (Swapped Domain - ws-br)');

    // 3. Comparar com o target
    console.log(`\nTarget esperado: ${CLEAN_TARGET_FROM_LOG}`);
}

run();
