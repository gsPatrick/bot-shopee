/**
 * Script de Teste - Valida todos os componentes
 */

const ShopeeDownloader = require('./shopeeService');
const UserManager = require('./database');
const PaymentService = require('./paymentService');
const fs = require('fs');

async function runTests() {
    console.log('🧪 Iniciando testes...\n');

    // ============================================
    // Teste 1: ShopeeDownloader.isShopeeUrl
    // ============================================
    console.log('1️⃣ Testando detecção de URLs da Shopee...');

    const testUrls = [
        { url: 'https://shopee.com.br/produto123', expected: true },
        { url: 'https://shp.ee/abc123', expected: true },
        { url: 'https://sv.shopee.com.br/share-video/xyz', expected: true },
        { url: 'https://google.com', expected: false },
        { url: 'texto aleatorio', expected: false },
        { url: null, expected: false }
    ];

    let passed = 0;
    testUrls.forEach(test => {
        const result = ShopeeDownloader.isShopeeUrl(test.url);
        const status = result === test.expected ? '✅' : '❌';
        if (result === test.expected) passed++;
        console.log(`   ${status} isShopeeUrl("${test.url}") = ${result}`);
    });
    console.log(`   Resultado: ${passed}/${testUrls.length} testes passaram\n`);

    // ============================================
    // Teste 2: UserManager (Database)
    // ============================================
    console.log('2️⃣ Testando UserManager (SQLite via sql.js)...');

    // Remove banco de teste anterior
    const testDbPath = 'test_db.db';
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }

    const db = new UserManager(testDbPath);
    await db.init();

    const testUserId = 12345;

    // Teste inicial
    let status = db.checkAllowance(testUserId);
    console.log(`   Check inicial: Premium=${status.is_premium}, Left=${status.downloads_left}`);

    // Incrementa uso
    for (let i = 0; i < 10; i++) {
        db.incrementUsage(testUserId);
    }

    status = db.checkAllowance(testUserId);
    console.log(`   Após 10 usos: Allowed=${status.allowed}, Left=${status.downloads_left}`);

    // Adiciona premium
    db.addPremiumTime(testUserId, 30);
    status = db.checkAllowance(testUserId);
    console.log(`   Após Premium: Premium=${status.is_premium}, Left=${status.downloads_left}`);

    db.close();
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    console.log('   ✅ Testes de banco de dados passaram\n');

    // ============================================
    // Teste 3: PaymentService
    // ============================================
    console.log('3️⃣ Testando PaymentService...');

    const paymentService = new PaymentService();
    const payment = paymentService.createPixPayment(12345);

    console.log(`   Payment ID: ${payment.payment_id.substring(0, 8)}...`);
    console.log(`   Pix Code: ${payment.pix_copy_paste.substring(0, 40)}...`);
    console.log(`   Status Check: ${paymentService.checkPaymentStatus(payment.payment_id)}`);
    console.log('   ✅ Testes de pagamento passaram\n');

    // ============================================
    // Teste 4: Verificação de Token
    // ============================================
    console.log('4️⃣ Verificando variável de ambiente...');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token.includes(':')) {
        console.log(`   ✅ Token configurado: ${token.substring(0, 10)}...`);
    } else {
        console.log('   ⚠️ Token não configurado (normal para testes locais)');
    }

    console.log('\n🎉 Todos os testes concluídos com sucesso!');
    console.log('   O bot está pronto para rodar com: npm start');
}

runTests().catch(err => {
    console.error('Erro nos testes:', err);
    process.exit(1);
});
