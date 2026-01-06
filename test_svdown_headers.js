const axios = require('axios');
const fs = require('fs');

const OUTPUT_FILE = 'debug_response.txt';
const API_URL = 'https://svdown.tech/api/resolve';
const TARGET_URL = 'https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr2Jgc1yLCACxxC0yAAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D970670860%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9';

// Limpa arquivo de log anterior
fs.writeFileSync(OUTPUT_FILE, `--- INÍCIO TESTE ${new Date().toISOString()} ---\n\n`);

function log(msg) {
    console.log(msg);
    fs.appendFileSync(OUTPUT_FILE, msg + '\n');
}

async function runTest(name, headers) {
    log(`\n\n=== TESTANDO: ${name} ===`);
    log('Headers enviados:');
    log(JSON.stringify(headers, null, 2));

    try {
        const response = await axios.post(API_URL, {
            url: TARGET_URL
        }, {
            headers: headers,
            validateStatus: () => true // Aceita qualquer status para logar
        });

        log(`\nSTATUS: ${response.status} ${response.statusText}`);
        log('HEADERS RESPOSTA:');
        log(JSON.stringify(response.headers, null, 2));
        log('BODY RESPOSTA:');
        log(JSON.stringify(response.data, null, 2));

        if (response.status === 200) {
            log('✅ SUCESSO NESTE CENÁRIO!');
        } else {
            log('❌ FALHA NESTE CENÁRIO');
        }

    } catch (e) {
        log(`\nERRO DE CONEXÃO: ${e.message}`);
        if (e.response) {
            log(`STATUS: ${e.response.status}`);
            log(JSON.stringify(e.response.data, null, 2));
        }
    }
}

async function main() {
    // Cenário 1: Headers Mínimos (que falhou antes)
    await runTest('1. Básico (Origin/Referer simples)', {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://svdown.tech',
        'Referer': 'https://svdown.tech/'
    });

    // Cenário 2: Simulando Chrome Completo
    await runTest('2. Emulação Chrome Completo', {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://svdown.tech',
        'Referer': 'https://svdown.tech/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Connection': 'keep-alive'
    });

    log('\n\n--- TESTE FINALIZADO ---');
    log(`Verifique o arquivo ${OUTPUT_FILE} para detalhes.`);
}

main();
