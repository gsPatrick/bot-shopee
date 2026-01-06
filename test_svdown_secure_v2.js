const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const SECRET = 'svdown-client-secret-v1-2024';
const API_URL = 'https://svdown.tech/api/resolve';
const HANDSHAKE_URL = 'https://svdown.tech/api/security/handshake';
const TARGET_URL = 'https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr2Jgc1yLCACxxC0yAAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D970670860%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function runTest(scenarioName, useCookieInSignature, sendCookieHeader) {
    console.log(`\n--- TESTE: ${scenarioName} ---`);
    console.log(`Signature Cookie: '${useCookieInSignature}'`);
    console.log(`Header Cookie: ${sendCookieHeader ? 'YES' : 'NO'}`);

    try {
        const storageId = crypto.randomUUID();
        // Se vamos enviar cookie no header, usamos o storageId como valor (comportamento padrao)
        const headerCookieVal = sendCookieHeader ? storageId : null;

        // Handshake
        const handshakeRes = await axios.get(HANDSHAKE_URL, {
            headers: { 'User-Agent': USER_AGENT }
        });
        const { seed, timestamp } = handshakeRes.data;

        // Assinatura
        const dataToSign = `${seed}${timestamp}${storageId}${useCookieInSignature}${USER_AGENT}`;

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
            'X-Storage-Id': storageId // UUID
        };

        if (headerCookieVal) {
            headers['Cookie'] = `svdown_uid=${headerCookieVal}`;
        }

        const response = await axios.post(API_URL, { url: TARGET_URL }, { headers });

        console.log('✅ SUCESSO! (200 OK)');
        console.log(JSON.stringify(response.data.video, null, 2));
        return true;

    } catch (e) {
        console.log(`❌ FALHA: ${e.response ? e.response.status : e.message}`);
        if (e.response) console.log(JSON.stringify(e.response.data));
        return false;
    }
}

async function main() {
    // Cenário 1: Assina com '' (vazio), Envia Cookie Header
    // (Simula user novo onde script.js leu cookie vazio mas a gente força o envio?)
    // Ou talvez script.js NAO SETA cookie antes do request?

    // Cenário A: Assina com '', Envia SEM Cookie
    await runTest('A: Sign("", No Cookie Header)', '', false);

    // Cenário B: Assina com '', Envia Cookie Header
    await runTest('B: Sign("", With Cookie Header)', '', true);

    // Cenário C: Assina com UID, Envia Cookie Header (Igual tentativa anterior, mas só pra garantir)
    await runTest('C: Sign(UID, With Cookie Header)', 'FORCE_UID', true);
}

// Pequeno helper pra Scenario C pegar o UID dinamicamente
const _origRunTest = runTest;
// ... (simplificado, vou deixar o C usar a lógica interna do UID se passar flag)
// Ajustando a funcao runTest para suportar Scenario C corretamente:
// Se useCookieInSignature === 'FORCE_UID', usa o storageId.

async function runTestAdjusted(scenarioName, cookieSigType, sendCookieHeader) {
    console.log(`\n--- TESTE: ${scenarioName} ---`);

    try {
        const storageId = crypto.randomUUID();
        const headerCookieVal = sendCookieHeader ? storageId : null;

        // Decide valor pro handshake
        let cookieForSig = '';
        if (cookieSigType === 'uid') cookieForSig = storageId;
        else cookieForSig = cookieSigType; // string literal

        const handshakeRes = await axios.get(HANDSHAKE_URL, { headers: { 'User-Agent': USER_AGENT } });
        const { seed, timestamp } = handshakeRes.data;

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
            'X-Storage-Id': storageId
        };
        if (headerCookieVal) headers['Cookie'] = `svdown_uid=${headerCookieVal}`;

        const response = await axios.post(API_URL, { url: TARGET_URL }, { headers });
        console.log('✅ SUCESSO! (200 OK)');
        return true;
    } catch (e) {
        console.log(`❌ FALHA: ${e.response ? e.response.status : e.message}`);
        return false;
    }
}

async function mainReal() {
    await runTestAdjusted('1. Sign: EMPTY | Header: EMPTY', '', false);
    await runTestAdjusted('2. Sign: EMPTY | Header: UID', '', true);
    await runTestAdjusted('3. Sign: UID   | Header: UID', 'uid', true);
}

mainReal();
