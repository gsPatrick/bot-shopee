/**
 * Database Manager for Shopee Video Downloader Bot
 * Gerencia usuários e cotas diárias usando SQLite (sql.js - pure JS)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class UserManager {
    constructor(dbPath = 'shopee_bot.db') {
        this.DAILY_LIMIT = 5;
        this.dbPath = dbPath;
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        const SQL = await initSqlJs();

        // Carrega banco existente ou cria novo
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
        }

        this._initDb();
        this.initialized = true;
    }

    _initDb() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                downloads_today INTEGER DEFAULT 0,
                last_download_date TEXT,
                is_premium INTEGER DEFAULT 0,
                plan_expiry_date TEXT
            )
        `);
        this._save();
    }

    _save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    _getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Verifica se o usuário pode fazer download
     * @returns {{ allowed: boolean, downloads_left: number, is_premium: boolean }}
     */
    checkAllowance(userId) {
        const today = this._getTodayStr();

        let result = this.db.exec(`SELECT downloads_today, last_download_date, is_premium, plan_expiry_date FROM users WHERE user_id = ${userId}`);

        if (result.length === 0 || result[0].values.length === 0) {
            // Novo usuário
            this.db.run(`INSERT INTO users (user_id, downloads_today, last_download_date, is_premium) VALUES (${userId}, 0, '${today}', 0)`);
            this._save();
            result = [{ values: [[0, today, 0, null]] }];
        }

        let [downloads_today, last_download_date, is_premium, plan_expiry_date] = result[0].values[0];

        // Verifica se virou o dia
        if (last_download_date !== today) {
            downloads_today = 0;
            this.db.run(`UPDATE users SET downloads_today = 0, last_download_date = '${today}' WHERE user_id = ${userId}`);
            this._save();
        }

        // Lógica de permissão
        let isPremiumBool = Boolean(is_premium);

        // Verifica validade do plano
        if (plan_expiry_date) {
            const expiryDate = new Date(plan_expiry_date);
            const todayDate = new Date(today);
            if (expiryDate >= todayDate) {
                isPremiumBool = true;
            }
        }

        const allowed = isPremiumBool || (downloads_today < this.DAILY_LIMIT);
        const downloadsLeft = isPremiumBool ? 9999 : Math.max(0, this.DAILY_LIMIT - downloads_today);

        return {
            allowed,
            downloads_left: downloadsLeft,
            is_premium: isPremiumBool
        };
    }

    /**
     * Incrementa o contador de downloads do dia
     */
    incrementUsage(userId) {
        const today = this._getTodayStr();
        this.db.run(`UPDATE users SET downloads_today = downloads_today + 1, last_download_date = '${today}' WHERE user_id = ${userId}`);
        this._save();
    }

    /**
     * Adiciona dias de premium ao usuário
     */
    addPremiumTime(userId, days) {
        const result = this.db.exec(`SELECT plan_expiry_date FROM users WHERE user_id = ${userId}`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let startDate = today;

        if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
            const currentExpiry = new Date(result[0].values[0][0]);
            if (currentExpiry >= today) {
                startDate = currentExpiry;
            }
        }

        const newExpiry = new Date(startDate);
        newExpiry.setDate(newExpiry.getDate() + days);
        const newExpiryStr = newExpiry.toISOString().split('T')[0];

        this.db.run(`UPDATE users SET plan_expiry_date = '${newExpiryStr}' WHERE user_id = ${userId}`);

        // Verifica se a atualização afetou alguma linha
        const changes = this.db.getRowsModified();
        if (changes === 0) {
            const todayStr = this._getTodayStr();
            this.db.run(`INSERT INTO users (user_id, downloads_today, last_download_date, is_premium, plan_expiry_date) VALUES (${userId}, 0, '${todayStr}', 0, '${newExpiryStr}')`);
        }
        this._save();
    }

    close() {
        if (this.db) {
            this._save();
            this.db.close();
        }
    }
}

module.exports = UserManager;
