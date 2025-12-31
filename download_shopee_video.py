import requests
import re
import urllib.parse

# 1. O Link que você mandou
link_shopee = "https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr6T2R8GyCABolDY2AAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D802457812%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9"

# Configurações do alvo
url_home = "https://svxtract.com/"
url_download = "https://svxtract.com/function/download/downloader.php"

# Headers para fingir ser um navegador (Cópia fiel do seu log)
headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://svxtract.com/',
    'Origin': 'https://svxtract.com'
}

# Cria sessão para manter os cookies (Isso é obrigatório)
session = requests.Session()
session.headers.update(headers)

print("1. Acessando a página inicial para pegar o Token...")
try:
    response_home = session.get(url_home)
    
    # O token está no JavaScript como: const csrfToken = "xxx"
    # Procurar por: csrfToken = "xxx" (variável JS)
    token_match = re.search(r'csrfToken\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)
    
    # Fallback: padrão original caso mudem para input hidden
    if not token_match:
        token_match = re.search(r'name="csrf_token" value="([a-f0-9]+)"', response_home.text)
    
    # Fallback 2: outro padrão JS
    if not token_match:
        token_match = re.search(r'csrf_token\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)

    if token_match:
        csrf_token = token_match.group(1)
        print(f"   Sucesso! Token capturado: {csrf_token}")
        
        # 2. Preparar a requisição de download
        params = {
            'url': link_shopee,
            'csrf_token': csrf_token,
            'preview': '1'
        }
        
        print("2. Enviando link para o endpoint de download...")
        # Note o stream=True para baixar arquivos grandes
        response_video = session.get(url_download, params=params, stream=True)
        
        if response_video.status_code == 200:
            # Verifica se é realmente um video
            content_type = response_video.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                print("   Erro: O site retornou HTML em vez de vídeo. O Token pode estar inválido ou o link não foi aceito.")
                print("   Resposta do site:", response_video.text[:500]) # Mostra o começo do erro
            else:
                # MODIFICADO: Salvar na pasta output_video
                nome_arquivo = "output_video/video_shopee_sem_marca.mp4"
                print(f"   Baixando vídeo para: {nome_arquivo} ...")
                print(f"   Content-Type: {content_type}")
                
                total_size = 0
                with open(nome_arquivo, 'wb') as f:
                    for chunk in response_video.iter_content(chunk_size=1024*1024):
                        if chunk:
                            f.write(chunk)
                            total_size += len(chunk)
                
                print(f"   Download Concluído com Sucesso!")
                print(f"   Tamanho do arquivo: {total_size / (1024*1024):.2f} MB")
        else:
            print(f"   Erro na requisição: Status {response_video.status_code}")
            print(f"   Resposta: {response_video.text[:300]}")
            
    else:
        print("   Falha: Não foi possível encontrar o 'csrf_token' no HTML da página inicial.")
        # Dica de debug: Salve o HTML para ver onde o token está escondido
        with open("debug_home.html", "w") as f: f.write(response_home.text)
        print("   Arquivo debug_home.html salvo para análise.")

except Exception as e:
    print(f"Ocorreu um erro: {e}")
