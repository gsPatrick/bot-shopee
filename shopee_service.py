"""
Shopee Video Downloader Service
Classe responsável por baixar vídeos da Shopee via svxtract.com
"""

import os
import re
import uuid
import requests
from typing import Optional


class ShopeeDownloader:
    """Classe para download de vídeos da Shopee sem marca d'água."""
    
    URL_HOME = "https://svxtract.com/"
    URL_DOWNLOAD = "https://svxtract.com/function/download/downloader.php"
    
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://svxtract.com/',
        'Origin': 'https://svxtract.com'
    }
    
    # Padrões regex para capturar o token CSRF
    TOKEN_PATTERNS = [
        r'csrfToken\s*=\s*["\']([a-f0-9]+)["\']',      # const csrfToken = "xxx"
        r'name="csrf_token" value="([a-f0-9]+)"',      # input hidden
        r'csrf_token\s*=\s*["\']([a-f0-9]+)["\']',     # var csrf_token = "xxx"
    ]
    
    def __init__(self, output_dir: str = "output_video"):
        """
        Inicializa o downloader.
        
        Args:
            output_dir: Diretório onde os vídeos serão salvos.
        """
        self.output_dir = output_dir
        self._ensure_output_dir()
        
    def _ensure_output_dir(self) -> None:
        """Cria o diretório de output se não existir."""
        os.makedirs(self.output_dir, exist_ok=True)
        
    def _get_csrf_token(self, session: requests.Session) -> Optional[str]:
        """
        Acessa a página inicial e extrai o token CSRF.
        
        Args:
            session: Sessão do requests para manter cookies.
            
        Returns:
            Token CSRF ou None se não encontrado.
        """
        response = session.get(self.URL_HOME)
        
        for pattern in self.TOKEN_PATTERNS:
            match = re.search(pattern, response.text)
            if match:
                return match.group(1)
                
        return None
    
    def _generate_filename(self) -> str:
        """Gera um nome de arquivo único usando UUID."""
        unique_id = str(uuid.uuid4())[:8]
        return f"video_{unique_id}.mp4"
    
    def download(self, shopee_url: str) -> Optional[str]:
        """
        Baixa o vídeo da Shopee e retorna o caminho do arquivo.
        
        Args:
            shopee_url: URL do vídeo da Shopee.
            
        Returns:
            Caminho absoluto do arquivo baixado ou None em caso de erro.
            
        Raises:
            Exception: Se o token não for encontrado ou download falhar.
        """
        # Cria sessão para manter cookies
        session = requests.Session()
        session.headers.update(self.HEADERS)
        
        # 1. Captura o token CSRF
        csrf_token = self._get_csrf_token(session)
        if not csrf_token:
            raise Exception("Não foi possível capturar o token CSRF.")
        
        # 2. Requisição de download
        params = {
            'url': shopee_url,
            'csrf_token': csrf_token,
            'preview': '1'
        }
        
        response = session.get(self.URL_DOWNLOAD, params=params, stream=True)
        
        if response.status_code != 200:
            raise Exception(f"Erro na requisição: Status {response.status_code}")
        
        # 3. Verifica se é realmente um vídeo
        content_type = response.headers.get('Content-Type', '')
        if 'text/html' in content_type:
            raise Exception("O serviço retornou HTML. O link pode ser inválido.")
        
        # 4. Salva o arquivo
        filename = self._generate_filename()
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
        
        # Retorna o caminho absoluto
        return os.path.abspath(filepath)
    
    @staticmethod
    def is_shopee_url(url: str) -> bool:
        """
        Verifica se a URL é da Shopee.
        
        Args:
            url: URL para verificar.
            
        Returns:
            True se for URL da Shopee, False caso contrário.
        """
        shopee_patterns = ['shopee.com', 'shp.ee', 'sv.shopee']
        return any(pattern in url.lower() for pattern in shopee_patterns)


# Teste local
if __name__ == "__main__":
    downloader = ShopeeDownloader()
    test_url = "https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr6T2R8GyCABolDY2AAAAAA%3D%3D"
    
    try:
        filepath = downloader.download(test_url)
        print(f"✅ Download concluído: {filepath}")
    except Exception as e:
        print(f"❌ Erro: {e}")
