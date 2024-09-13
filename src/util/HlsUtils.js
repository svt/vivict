import {Parser} from 'm3u8-parser';

export function isHlsPlaylist(url) {
    if (!url) return false;
    return url.split('?')[0].endsWith('.m3u8');
}

export async function parseHlsManifest(url) {
    const response = await fetch(url);
    const manifestText = await response.text();
    const parser = new Parser();
    parser.push(manifestText);
    parser.end();
    const manifest = parser.manifest;
    const variants = manifest.playlists.map( playlist => {
        return {
            url: resolveVariantUrl(url, playlist.uri),
            bandwidth: playlist.attributes.BANDWIDTH,
            ...playlist.attributes.RESOLUTION,
        };
    }).sort((a, b) => a.bandwidth - b.bandwidth);

    return {
        mainUrl: url,
        variants,
        selectedVariant: variants.length - 1,
    };
}

function resolveVariantUrl(mainUrl, variantUrl) {
    if (isAbsoluteUrl(variantUrl)) {
        return variantUrl;
    }
    return mainUrl.replace(/\/[^/]*$/, '/' + variantUrl)
}

function isAbsoluteUrl(url) {
    return (url.indexOf('http://') === 0 || url.indexOf('https://') === 0)
}