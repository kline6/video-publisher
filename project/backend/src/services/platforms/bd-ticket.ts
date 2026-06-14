import crypto from "crypto";

export function generateBdTicketHeaders(
  privateKeyPem: string,
  webProtectJson: string,
  path: string
): Record<string, string> {
  try {
    const webProtect = JSON.parse(webProtectJson);
    const ticket = webProtect.ticket || "";
    const ts_sign = webProtect.ts_sign || "";
    const client_cert = webProtect.client_cert || "";

    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signData = path + nonce + timestamp;

    const sign = crypto.createSign("SHA256");
    sign.update(signData);
    sign.end();
    const signature = sign.sign(privateKeyPem, "base64");

    const hash = crypto.createHash("sha256").update(signData).digest("base64");

    return {
      "bd-ticket-guard-web-hash": hash,
      "bd-ticket-guard-web-nonce": nonce,
      "bd-ticket-guard-web-sign": signature,
      "bd-ticket-guard-web-tick": ticket,
      "bd-ticket-guard-web-cert": client_cert,
      "bd-ticket-guard-web-version": "2",
    };
  } catch (e: any) {
    console.warn("[BdTicket] Generation failed:", e.message);
    return {};
  }
}
