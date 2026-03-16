const OpenTimestamps = require("opentimestamps");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function isBase64(s) {
  return typeof s === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

function isHexSha256(s) {
  return typeof s === "string" && /^[0-9a-fA-F]{64}$/.test(s);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { message: "Invalid JSON body" });
  }

  const otsB64 = body.ots_b64;
  const sha256 = body.sha256;
  const encoding = body.encoding;

  if (encoding !== "base64") {
    return json(400, { message: "Invalid encoding (expected base64)" });
  }
  if (!isBase64(otsB64)) {
    return json(400, { message: "Invalid ots_b64" });
  }
  if (!isHexSha256(sha256)) {
    return json(400, { message: "Invalid sha256 (expected 64 hex chars)" });
  }

  let bytes;
  try {
    bytes = Buffer.from(otsB64, "base64");
  } catch {
    return json(400, { message: "Invalid base64" });
  }

  try {
    const detachedStamped = OpenTimestamps.DetachedTimestampFile.deserialize(new Uint8Array(bytes));

    const digest = Buffer.from(sha256, "hex");
    const detachedOriginal = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      digest
    );

    const attestations = await OpenTimestamps.verify(detachedStamped, detachedOriginal, {
      ignoreBitcoinNode: true,
    });

    return json(200, { verified: true, attestations });
  } catch (err) {
    const msg = err?.message || String(err);

    // Common case: proof exists but not yet anchored enough to verify.
    if (/PendingAttestation|pending attestation|pending/i.test(msg)) {
      return json(200, { verified: false, reason: "pending" });
    }

    // Digest mismatch between provided sha256 and the proof.
    if (/File does not match original/i.test(msg)) {
      return json(400, { message: msg });
    }

    // Deserialization errors should be 400.
    if (/deserialize|deserialization|magic|timestamp file|Invalid timestamp/i.test(msg)) {
      return json(400, { message: msg });
    }

    console.error(err);
    return json(500, { message: msg });
  }
};
