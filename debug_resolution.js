const ShopeeDownloader = require('./shopeeService');

async function test() {
    const downloader = new ShopeeDownloader();
    const url = 'https://shopee.com.br/universal-link?redir=https%3A%2F%2Fsv.shopee.com.br%2Fshare-video%2Fr2Jgc1yLCACxxC0yAAAAAA%3D%3D%3FfromSource%3Dcopy_link%26fromShareLink%3Dshare-marker%26shareUserId%3D970670860%26contentType%3D0%26jumpType%3Dshare%26pid%3Dsv%26c%3Dshare_web%26share_obj%3Dvideo%26myVideo%3Dfalse&deep_and_web=1&smtt=0.0.9';

    console.log('Testing URL:', url);
    const finalUrl = await downloader._resolveUrl(url);
    console.log('Resolved URL:', finalUrl);
}

test();
