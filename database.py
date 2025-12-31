"""
Database Manager for Shopee Video Downloader Bot
Gerencia usuários e cotas diárias usando SQLite.
"""

import sqlite3
import datetime
from threading import Lock

class UserManager:
    """Gerencia dados de usuários e limites de download."""
    
    DB_NAME = "shopee_bot.db"
    DAILY_LIMIT = 10
    
    def __init__(self, db_name=None):
        if db_name:
            self.DB_NAME = db_name
        self.lock = Lock()
        self._init_db()
        self._migrate_db()

    def _get_connection(self):
        """Retorna uma conexão com o banco de dados."""
        return sqlite3.connect(self.DB_NAME, check_same_thread=False)

    def _init_db(self):
        """Inicializa a tabela de usuários se não existir."""
        with self.lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    downloads_today INTEGER DEFAULT 0,
                    last_download_date TEXT,
                    is_premium INTEGER DEFAULT 0,
                    plan_expiry_date TEXT
                )
            ''')
            
            conn.commit()
            conn.close()

    def _migrate_db(self):
        """Migra o banco de dados para adicionar colunas novas."""
        with self.lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            try:
                # Tenta adicionar a coluna plan_expiry_date
                cursor.execute("ALTER TABLE users ADD COLUMN plan_expiry_date TEXT")
                conn.commit()
            except sqlite3.OperationalError:
                # Coluna já existe
                pass
            finally:
                conn.close()

    def _get_today_str(self):
        """Retorna a data de hoje como string YYYY-MM-DD."""
        return datetime.date.today().isoformat()

    def check_allowance(self, user_id: int) -> dict:
        """
        Verifica se o usuário pode fazer download.
        
        Args:
            user_id: ID do usuário Telegram.
            
        Returns:
            Dict com status: {'allowed': bool, 'downloads_left': int, 'is_premium': bool}
        """
        today = self._get_today_str()
        
        with self.lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Busca usuário
            cursor.execute('SELECT downloads_today, last_download_date, is_premium, plan_expiry_date FROM users WHERE user_id = ?', (user_id,))
            row = cursor.fetchone()
            
            if row is None:
                # Novo usuário
                cursor.execute('INSERT INTO users (user_id, downloads_today, last_download_date, is_premium) VALUES (?, 0, ?, 0)', (user_id, today))
                conn.commit()
                row = (0, today, 0, None)
            
            downloads_today, last_download_date, is_premium, plan_expiry_date = row
            
            # Verifica se virou o dia
            if last_download_date != today:
                downloads_today = 0
                cursor.execute('UPDATE users SET downloads_today = 0, last_download_date = ? WHERE user_id = ?', (today, user_id))
                conn.commit()
            
            conn.close()
            
            # Lógica de permissão
            # Premium se is_premium=1 (legado) OU se data de validade > hoje
            is_premium_bool = bool(is_premium)
            if plan_expiry_date:
                expiry_dt = datetime.datetime.fromisoformat(plan_expiry_date).date()
                if expiry_dt >= datetime.date.today():
                    is_premium_bool = True
            
            allowed = is_premium_bool or (downloads_today < self.DAILY_LIMIT)
            
            # Se premium, downloads_left é "infinito" (ex: 9999) para UI
            downloads_left = 9999 if is_premium_bool else (self.DAILY_LIMIT - downloads_today)
            if downloads_left < 0: downloads_left = 0
            
            return {
                'allowed': allowed,
                'downloads_left': downloads_left,
                'is_premium': is_premium_bool
            }

    def increment_usage(self, user_id: int):
        """Incrementa o contador de downloads do dia."""
        today = self._get_today_str()
        
        with self.lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Atualiza contador e garante que a data está correta
            cursor.execute('''
                UPDATE users 
                SET downloads_today = downloads_today + 1, last_download_date = ? 
                WHERE user_id = ?
            ''', (today, user_id))
            
            conn.commit()
            conn.close()

    def add_premium_time(self, user_id: int, days: int):
        """Adiciona dias de premium ao usuário."""
        with self.lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Busca validade atual
            cursor.execute('SELECT plan_expiry_date FROM users WHERE user_id = ?', (user_id,))
            row = cursor.fetchone()
            
            today = datetime.date.today()
            current_expiry = None
            
            if row and row[0]:
                current_expiry = datetime.datetime.fromisoformat(row[0]).date()
            
            # Se já tem validade futura, soma. Se não, começa de hoje.
            start_date = current_expiry if (current_expiry and current_expiry >= today) else today
            new_expiry = start_date + datetime.timedelta(days=days)
            new_expiry_str = new_expiry.isoformat()
            
            # Atualiza ou insere usuário
            cursor.execute('UPDATE users SET plan_expiry_date = ? WHERE user_id = ?', (new_expiry_str, user_id))
            if cursor.rowcount == 0:
                today_str = self._get_today_str()
                cursor.execute('INSERT INTO users (user_id, downloads_today, last_download_date, is_premium, plan_expiry_date) VALUES (?, 0, ?, 0, ?)', (user_id, today_str, new_expiry_str))
                
            conn.commit()
            conn.close()

# Teste local
if __name__ == "__main__":
    db = UserManager("test.db")
    uid = 12345
    
    print(f"Check 1: {db.check_allowance(uid)}")
    db.increment_usage(uid)
    print(f"Check 2 (após 1 uso): {db.check_allowance(uid)}")
    
    # Simula limite
    for _ in range(9): db.increment_usage(uid)
    print(f"Check 3 (após 10 usos): {db.check_allowance(uid)}")
    
    db.set_premium(uid, True)
    print(f"Check 4 (Premium): {db.check_allowance(uid)}")
    
    import os
    os.remove("test.db")
