// eslint-disable-next-line no-undef
const mediaInfoFactory = globalThis.MediaInfo.default;
const mediainfo = await mediaInfoFactory({chunkSize: 10 * 1024 * 1024});
let reportProgressFn = () => {};

export async function getMediaInfo(source, reportProgress) {
    if (reportProgress) {
        reportProgressFn = reportProgress;
    }

    if (source.type === 'file') {
        // https://github.com/buzz/mediainfo.js/blob/8a9a9f2d3540261ea3bebdf8bcea1f0c443d55fa/examples/browser-umd/example.js#L13
        const file = source.file;
        let loadedSize = 0;
        const readFileChunk = async (chunkSize, offset) => {
            loadedSize += chunkSize;
            reportProgressFn(`${((loadedSize / file.size) * 100).toFixed(2)}%`);
            return new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
        };
        const result = await mediainfo.analyzeData(file.size, readFileChunk);
        console.log('mediainfo result', result);
        mediainfo.close();
        return result;
    }

    // source.type === 'url'
    const result = await mediainfo.analyzeData(getUrlMediaSize(source.url), readUrlChunk(source.url));
    console.log('mediainfo result', result);
    mediainfo.close();
    return result;
}

let totalSize = 0;
let loadedSize = 0;

const getUrlMediaSize = url => async () => {
    const response = await fetch(url, {method: 'HEAD'});
    const length = response.ok ? parseInt(response.headers.get('Content-Length') ?? '0', 10) : 0;

    if (length) {
        totalSize = parseInt(length, 10);
    } else {
        console.error("HEAD request doesn't provide a Content-Length");
        // 6GB absolute max for range fetching.
        // Most likely won't use this as readUrlChunk should quit when done.
        totalSize = 5 * 1024 * 1024 * 1024;
    }
    return totalSize;
};

const readUrlChunk = url => async (chunkSize, offset) => {
    if (chunkSize === 0) return new Uint8Array();

    const from = offset;
    const to = offset + chunkSize;
    const start = to < from ? to : from;
    const end = to < from ? from : to;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Range: `bytes=${start}-${end}`,
        },
    });

    loadedSize += end - start;
    reportProgressFn(`${((loadedSize / totalSize) * 100).toFixed(2)}%`);

    if (!response.ok) {
        // Probably end of the file. Return empty to stop fetching/reading
        console.warn(`HTTP error status=${response.status}: ${response.statusText}`);
        return new Uint8Array();
    }
    return new Uint8Array(await response.arrayBuffer());
};
