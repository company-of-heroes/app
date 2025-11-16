/**
 * Get websocket connection
 * Keeps trying to connect until successful.
 * 
 * @param {string} url - The WebSocket URL to connect to.
 * @returns {Promise<WebSocket>}
 */
export const getConnection = (url) => {
    return new Promise(resolve => {
        let ws;
        let interval = setInterval(() => {
            ws = new WebSocket(url);
            ws.addEventListener('open', () => {
                clearInterval(interval);
                resolve(ws);
            })
        }, 1000);
    })
}