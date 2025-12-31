# 📹 Documentação PoC - Shopee Video Downloader

> **Projeto:** Prova de Conceito para Download de Vídeos da Shopee sem Marca D'água  
> **Data:** 26 de Dezembro de 2025  
> **Status:** ✅ Sucesso

---

## 📋 Índice

1. [Objetivo](#objetivo)
2. [Contexto Técnico](#contexto-técnico)
3. [Requisitos](#requisitos)
4. [Execução Passo a Passo](#execução-passo-a-passo)
5. [Problemas Encontrados e Soluções](#problemas-encontrados-e-soluções)
6. [Código Final](#código-final)
7. [Resultados](#resultados)
8. [Conclusões](#conclusões)

---

## Objetivo

Validar uma Prova de Conceito (PoC) para baixar vídeos da Shopee sem marca d'água utilizando o backend do serviço **svxtract.com**, emulando um navegador real para capturar tokens de segurança e efetuar o download.

### Link de Teste Utilizado

```
https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr6T2R8GyCABolDY2AAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D802457812%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9
```

---

## Contexto Técnico

### Arquitetura do Sistema Alvo (svxtract.com)

O serviço svxtract.com utiliza um mecanismo de proteção baseado em:

1. **Sessão (Cookies):** Mantida via `requests.Session()`
2. **Token CSRF:** Gerado dinamicamente no JavaScript da página inicial
3. **Validação de Headers:** User-Agent e Referer são verificados

### Endpoints Identificados

| Endpoint | Método | Função |
|----------|--------|--------|
| `https://svxtract.com/` | GET | Página inicial (contém o token CSRF) |
| `https://svxtract.com/function/download/downloader.php` | GET | Download do vídeo |
| `https://svxtract.com/function/download/credits.php` | GET | Informações do criador do vídeo |

### Parâmetros do Endpoint de Download

```
url        = [URL do vídeo Shopee codificada]
csrf_token = [Token capturado da página inicial]
preview    = 1 (opcional, para streaming)
```

---

## Requisitos

### Dependências Python

```bash
pip install requests
```

### Estrutura de Diretórios

```
python teste/
├── venv/                              # Ambiente virtual Python
├── output_video/                      # Pasta para os vídeos baixados
├── download_shopee_video.py           # Script principal
├── debug_home.html                    # HTML de debug (gerado em caso de falha)
└── DOCUMENTACAO_POC_SHOPEE_DOWNLOADER.md
```

---

## Execução Passo a Passo

### 1️⃣ Criação da Pasta de Output

```bash
mkdir -p output_video
```

**Resultado:** ✅ Sucesso

---

### 2️⃣ Verificação da Biblioteca `requests`

```bash
pip3 show requests
```

**Resultado:** ❌ Falha - Biblioteca não encontrada

```
WARNING: Package(s) not found: requests
```

---

### 3️⃣ Tentativa de Instalação Global

```bash
pip3 install requests
```

**Resultado:** ❌ Falha - Ambiente gerenciado externamente (Homebrew)

```
error: externally-managed-environment

× This environment is externally managed
╰─> To install Python packages system-wide, try brew install xyz...
```

---

### 4️⃣ Criação de Ambiente Virtual

```bash
python3 -m venv venv
source venv/bin/activate
pip install requests
```

**Resultado:** ✅ Sucesso

```
Successfully installed certifi-2025.11.12 charset_normalizer-3.4.4 
idna-3.11 requests-2.32.5 urllib3-2.6.2
```

---

### 5️⃣ Primeira Execução do Script (Versão Original)

```bash
source venv/bin/activate && python download_shopee_video.py
```

**Resultado:** ❌ Falha - Token não encontrado

```
1. Acessando a página inicial para pegar o Token...
   Falha: Não foi possível encontrar o 'csrf_token' no HTML da página inicial.
   Arquivo debug_home.html salvo para análise.
```

---

### 6️⃣ Análise do HTML de Debug

Analisando o arquivo `debug_home.html` (492 linhas), identificamos o token na **linha 396**:

```javascript
const csrfToken = "a0ca748aa9c8ea6a37a4b4ae88e3e333f03852bef1716096a0b8a72023b2c013";
```

#### Problema Identificado

O padrão regex original procurava por:
- `name="csrf_token" value="xxx"` (input hidden)
- `csrf_token = "xxx"` (variável JS)

Mas o token estava definido como:
- `const csrfToken = "xxx"` (variável const JS)

---

### 7️⃣ Correção do Regex

**Antes:**
```python
token_match = re.search(r'name="csrf_token" value="([a-f0-9]+)"', response_home.text)
if not token_match:
    token_match = re.search(r'csrf_token\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)
```

**Depois:**
```python
# Padrão principal: const csrfToken = "xxx"
token_match = re.search(r'csrfToken\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)

# Fallbacks para outros formatos
if not token_match:
    token_match = re.search(r'name="csrf_token" value="([a-f0-9]+)"', response_home.text)
if not token_match:
    token_match = re.search(r'csrf_token\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)
```

---

### 8️⃣ Segunda Execução (Versão Corrigida)

```bash
source venv/bin/activate && python download_shopee_video.py
```

**Resultado:** ✅ Sucesso

```
1. Acessando a página inicial para pegar o Token...
   Sucesso! Token capturado: 1ef4b5f8dd3bda2bdf00ff8fdb927cdec1a94bd491da9e04028c94cac39853a5
2. Enviando link para o endpoint de download...
   Baixando vídeo para: output_video/video_shopee_sem_marca.mp4 ...
   Content-Type: application/octet-stream
   Download Concluído com Sucesso!
   Tamanho do arquivo: 0.53 MB
```

---

### 9️⃣ Validação do Arquivo Baixado

```bash
ls -lh output_video/
file output_video/video_shopee_sem_marca.mp4
```

**Resultado:** ✅ Arquivo válido

```
-rw-r--r--  1 patricksiqueira  staff  547K Dec 26 13:44 video_shopee_sem_marca.mp4
output_video/video_shopee_sem_marca.mp4: ISO Media, MP4 Base Media v1 [ISO 14496-12:2003]
```

---

## Problemas Encontrados e Soluções

| # | Problema | Causa | Solução |
|---|----------|-------|---------|
| 1 | Biblioteca `requests` não encontrada | Não instalada no sistema | Instalar via pip |
| 2 | `externally-managed-environment` | macOS com Homebrew impede instalação global | Criar ambiente virtual com `python3 -m venv venv` |
| 3 | Token CSRF não encontrado | Regex incorreto para o formato usado pelo site | Atualizar regex para `csrfToken\s*=\s*["\']([a-f0-9]+)["\']` |

---

## Código Final

```python
import requests
import re
import urllib.parse

# 1. O Link que você mandou
link_shopee = "https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr6T2R8GyCABolDY2AAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D802457812%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9"

# Configurações do alvo
url_home = "https://svxtract.com/"
url_download = "https://svxtract.com/function/download/downloader.php"

# Headers para fingir ser um navegador
headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://svxtract.com/',
    'Origin': 'https://svxtract.com'
}

# Cria sessão para manter os cookies
session = requests.Session()
session.headers.update(headers)

print("1. Acessando a página inicial para pegar o Token...")
try:
    response_home = session.get(url_home)
    
    # O token está no JavaScript como: const csrfToken = "xxx"
    token_match = re.search(r'csrfToken\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)
    
    # Fallbacks
    if not token_match:
        token_match = re.search(r'name="csrf_token" value="([a-f0-9]+)"', response_home.text)
    if not token_match:
        token_match = re.search(r'csrf_token\s*=\s*["\']([a-f0-9]+)["\']', response_home.text)

    if token_match:
        csrf_token = token_match.group(1)
        print(f"   Sucesso! Token capturado: {csrf_token}")
        
        params = {
            'url': link_shopee,
            'csrf_token': csrf_token,
            'preview': '1'
        }
        
        print("2. Enviando link para o endpoint de download...")
        response_video = session.get(url_download, params=params, stream=True)
        
        if response_video.status_code == 200:
            content_type = response_video.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                print("   Erro: O site retornou HTML em vez de vídeo.")
                print("   Resposta do site:", response_video.text[:500])
            else:
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
    else:
        print("   Falha: Token não encontrado.")
        with open("debug_home.html", "w") as f: 
            f.write(response_home.text)

except Exception as e:
    print(f"Ocorreu um erro: {e}")
```

---

## Resultados

### Métricas de Sucesso

| Métrica | Valor |
|---------|-------|
| Token CSRF capturado | ✅ Sim |
| Status HTTP da requisição | 200 OK |
| Content-Type do arquivo | `application/octet-stream` |
| Tamanho do arquivo | 547 KB (0.53 MB) |
| Tipo do arquivo | ISO Media, MP4 Base Media v1 |
| Arquivo válido | ✅ Sim |

### Evidências

1. **Token capturado:** `1ef4b5f8dd3bda2bdf00ff8fdb927cdec1a94bd491da9e04028c94cac39853a5`
2. **Arquivo gerado:** `output_video/video_shopee_sem_marca.mp4`
3. **Validação via `file`:** Confirma formato MP4 (ISO 14496-12:2003)

---

## Conclusões

### ✅ O que funcionou

1. **Emulação de navegador:** Os headers fornecem user-agent, referer e origin válidos
2. **Sessão persistente:** `requests.Session()` mantém cookies entre requisições
3. **Captura de token CSRF:** Regex atualizado extrai corretamente o token do JavaScript
4. **Download streaming:** `stream=True` permite baixar arquivos grandes em chunks
5. **Validação de tipo:** Verificação do Content-Type previne erros silenciosos

### ⚠️ Pontos de Atenção

1. **Token dinâmico:** O token muda a cada requisição à página inicial (comportamento esperado)
2. **Formato do token:** O site pode mudar o formato no futuro (de `csrfToken` para outro)
3. **Rate limiting:** Não identificado, mas pode existir para muitas requisições
4. **Compatibilidade de links:** Testado apenas com um link específico da Shopee Brasil

### 🔮 Melhorias Futuras

1. Adicionar suporte para múltiplos links (batch download)
2. Extrair informações do criador via endpoint `/credits.php`
3. Implementar retry automático em caso de falha
4. Adicionar barra de progresso para downloads longos
5. Suporte para outros domínios da Shopee (PH, TW, etc.)

---

## Licença e Aviso Legal

> ⚠️ **Disclaimer:** Esta PoC é apenas para fins educacionais e de pesquisa. O uso desta ferramenta deve respeitar os termos de serviço da Shopee e as leis de direitos autorais aplicáveis. Sempre credite os criadores originais ao usar conteúdo baixado.

---

*Documentação gerada em 26/12/2025 - PoC Shopee Video Downloader v1.0*
