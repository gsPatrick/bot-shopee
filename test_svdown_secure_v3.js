const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const SECRET = 'svdown-client-secret-v1-2024';
const API_URL = 'https://svdown.tech/api/resolve';
const HANDSHAKE_URL = 'https://svdown.tech/api/security/handshake';
const TARGET_URL = 'https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr2Jgc1yLCACxxC0yAAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D970670860%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function runTest(scenarioName, cookieSigValue) {
    console.log(`\n--- TESTE v3: ${scenarioName} ---`);

    try {
        const storageId = crypto.randomUUID();
        // NOTA: O log do navegador mostrou esse cookie extra. Pode ser obrigatório.
        const cookieHeader = `svdown_key=dev-key; svdown_uid=${storageId}`;

        // Handshake
        const handshakeRes = await axios.get(HANDSHAKE_URL, {
            headers: { 'User-Agent': USER_AGENT }
        });
        const { seed, timestamp } = handshakeRes.data;

        // Assinatura: seed + timestamp + storageId + cookieId + userAgent
        // Aqui cookieId = cookieSigValue (que pode ser vazio '' ou storageId)
        const dataToSign = `${seed}${timestamp}${storageId}${cookieSigValue}${USER_AGENT}`;

        const hmac = crypto.createHmac('sha256', SECRET);
        hmac.update(dataToSign);
        const signature = hmac.digest('hex');
        const xSecureToken = `${timestamp}:${seed}:${signature}`;

        // Headers
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
            'Origin': 'https://svdown.tech',
            'Referer': 'https://svdown.tech/',
            'X-Secure-Token': xSecureToken,
            'X-Storage-Id': storageId,
            'Cookie': cookieHeader // INCLUINDO svdown_key=dev-key
        };

        const response = await axios.post(API_URL, { url: TARGET_URL }, { headers });

        console.log('✅ SUCESSO! (200 OK)');
        console.log(JSON.stringify(response.data.video, null, 2));
        return true;

    } catch (e) {
        console.log(`❌ FALHA: ${e.response ? e.response.status : e.message}`);
        if (e.response && e.response.data) console.log(JSON.stringify(e.response.data));
        return false;
    }
}

async function main() {
    // Cenário 1: Assina com CookieID vazio (''), mas envia o cookie completo no header
    // (Mais provável, pois script.js inicializa cookieId vazio se nao existir)
    await runTest('1. Sign(EMPTY) + Full Cookie Header', '');

    // Cenário 2: Assina com CookieID = storageId
    await runTest('2. Sign(UID) + Full Cookie Header', 'UID_PLACEHOLDER');
    // Nota: Vou ajustar a func para usar o UID real se passar essa string
}

const _origRunTest = runTest;
async function runTestAdjusted(scenarioName, cookieSigType) {
    console.log(`\n--- TESTE v3: ${scenarioName} ---`);
    try {
        const storageId = crypto.randomUUID();
        const cookieHeader = `svdown_key=dev-key; svdown_uid=${storageId}`;

        const handshakeRes = await axios.get(HANDSHAKE_URL, { headers: { 'User-Agent': USER_AGENT } });
        const { seed, timestamp } = handshakeRes.data;

        let cookieForSig = '';
        if (cookieSigType === 'FIX_UID') cookieForSig = storageId;

        const dataToSign = `${seed}${timestamp}${storageId}${cookieForSig}${USER_AGENT}`;

        const hmac = crypto.createHmac('sha256', SECRET);
        hmac.update(dataToSign);
        const signature = hmac.digest('hex');
        const xSecureToken = `${timestamp}:${seed}:${signature}`;

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
            'Origin': 'https://svdown.tech',
            'Referer': 'https://svdown.tech/',
            'X-Secure-Token': xSecureToken,
            'X-Storage-Id': storageId,
            'Cookie': cookieHeader
        };

        const response = await axios.post(API_URL, { url: TARGET_URL }, { headers });
        console.log('✅ SUCESSO! (200 OK)');
        console.log(JSON.stringify(response.data.video, null, 2));
        return true;
    } catch (e) {
        console.log(`❌ FALHA: ${e.response ? e.response.status : e.message}`);
        return false;
    }
}

async function mainReal() {
    await runTestAdjusted('1. Sign: EMPTY', '');
    await runTestAdjusted('2. Sign: UID', 'FIX_UID');
}

mainReal();
