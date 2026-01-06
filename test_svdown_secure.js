const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const SECRET = 'svdown-client-secret-v1-2024';
const API_URL = 'https://svdown.tech/api/resolve';
const HANDSHAKE_URL = 'https://svdown.tech/api/security/handshake';
const TARGET_URL = 'https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr2Jgc1yLCACxxC0yAAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D970670860%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9';

// User Agent consistente
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testSecure() {
    console.log('--- TESTE SECURE TOKEN SVDOWN ---');

    try {
        // 1. Gera IDs
        const storageId = crypto.randomUUID();
        const cookieId = storageId; // Usando o mesmo para simplificar

        console.log(`1. IDs Gerados: ${storageId}`);

        // 2. Handshake
        console.log('2. Buscando Handshake...');
        const handshakeRes = await axios.get(HANDSHAKE_URL, {
            headers: { 'User-Agent': USER_AGENT }
        });
        const { seed, timestamp } = handshakeRes.data;
        console.log(`   Seed: ${seed}, Timestamp: ${timestamp}`);

        // 3. Assinatura HMAC-SHA256
        console.log('3. Gerando Assinatura...');
        const dataToSign = `${seed}${timestamp}${storageId}${cookieId}${USER_AGENT}`;

        const hmac = crypto.createHmac('sha256', SECRET);
        hmac.update(dataToSign);
        const signature = hmac.digest('hex');

        const xSecureToken = `${timestamp}:${seed}:${signature}`;
        console.log(`   Token: ${xSecureToken}`);

        // 4. Request Final
        console.log('4. Enviando Request para /api/resolve...');
        const response = await axios.post(API_URL, {
            url: TARGET_URL
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': 'https://svdown.tech',
                'Referer': 'https://svdown.tech/',
                'X-Secure-Token': xSecureToken,
                'X-Storage-Id': storageId,
                'Cookie': `svdown_uid=${storageId}`
            }
        });

        console.log('\n✅ SUCESSO! (200 OK)');
        console.log('Dados do Vídeo:');
        console.log(JSON.stringify(response.data.video, null, 2));

        // Salva resultado num arquivo para eu ver se precisar
        fs.writeFileSync('debug_secure_result.json', JSON.stringify(response.data, null, 2));

    } catch (e) {
        console.log(`\n❌ FALHA: ${e.message}`);
        if (e.response) {
            console.log(`   Status: ${e.response.status}`);
            console.log(`   Body: ${JSON.stringify(e.response.data)}`);
        }
    }
}

testSecure();
