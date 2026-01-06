const axios = require('axios');

async function testDirect() {
    // URL decodificada do universal-link
    const url = 'https://sv.shopee.com.br/share-video/r2Jgc1yLCACxxC0yAAAAAA==?fromSource=copy_link&fromShareLink=share-marker&shareUserId=970670860&contentType=0&jumpType=share&pid=sv&c=share_web&share_obj=video&myVideo=false';

    console.log('--- TESTE DIRETO SHOPEE VIDEO ---');

    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        console.log('Status: 200 OK');
        // Procura por links de mp4 no HTML
        const mp4Matches = data.match(/https?:\/\/[^"']+\.mp4/g);

        if (mp4Matches) {
            console.log('✅ Links MP4 encontrados:');
            mp4Matches.forEach(link => console.log(link));
        } else {
            console.log('❌ Nenhum link .mp4 direto encontrado (pode estar em JSON/Blob)');
            // Tenta achar JSON de dados
            if (data.includes('window.__INITIAL_STATE__')) {
                console.log('⚠️ Encontrei window.__INITIAL_STATE__ (Json Data)');
            }
        }

    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
    }
}

testDirect();
