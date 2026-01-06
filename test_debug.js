const axios = require('axios');

async function testSvDown() {
    console.log('--- TESTE SVDOWN ---');
    const url = 'https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2FaqJNLEiECABbHRgWAAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D970670860%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9';

    // Tentativa 1: Headers básicos
    try {
        console.log('Tentativa 1 (Sem Origin/Referer)...');
        await axios.post('https://svdown.tech/api/resolve', { url }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log('✅ Tentativa 1: Sucesso (200 OK)');
    } catch (e) {
        console.log(`❌ Tentativa 1 falhou: ${e.response ? e.response.status : e.message}`);
    }

    // Tentativa 2: Com Origin e Referer
    try {
        console.log('Tentativa 2 (Com Origin/Referer)...');
        const res = await axios.post('https://svdown.tech/api/resolve', { url }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://svdown.tech',
                'Referer': 'https://svdown.tech/'
            }
        });
        console.log('✅ Tentativa 2: Sucesso (200 OK)');
        console.log('Dados recebidos:', res.data.video ? 'Sim' : 'Não');
    } catch (e) {
        console.log(`❌ Tentativa 2 falhou: ${e.response ? e.response.status : e.message}`);
    }
}

function testWebhookValidation() {
    console.log('\n--- TESTE VALIDAÇÃO WEBHOOK ---');

    // Simulando o valor que provavelmente está no .env do usuário
    const badEnvVar = "https://geral-bot-shopee.r954jc.easypanel.host/webhook (Opcional por enquanto)";

    console.log(`Input: "${badEnvVar}"`);

    // Lógica ATUAL (Simulação)
    let webhookUrl = badEnvVar;
    if (!webhookUrl ||
        webhookUrl.includes('SEU_WEBHOOK_AQUI') ||
        !webhookUrl.startsWith('http')) {
        webhookUrl = null;
    }
    console.log(`Resultado Lógica Atual: ${webhookUrl} (Isso quebra a API se contiver espaços ou texto extra)`);

    // Lógica NOVA PROPOSTA
    let newUrl = badEnvVar;
    // Pega apenas a primeira parte da string (antes de qualquer espaço)
    newUrl = newUrl ? newUrl.split(' ')[0] : null;

    if (!newUrl ||
        !newUrl.startsWith('http') ||
        newUrl.includes('SEU_WEBHOOK_AQUI') ||
        !tryParseUrl(newUrl)) {
        newUrl = null;
    }
    console.log(`Resultado Lógica Nova: ${newUrl}`);
}

function tryParseUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function run() {
    await testSvDown();
    testWebhookValidation();
}

run();
