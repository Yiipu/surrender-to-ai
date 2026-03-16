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
  const encoding = body.encoding;

  if (encoding !== "base64") {
    return json(400, { message: "Invalid encoding (expected base64)" });
  }
  if (!isBase64(otsB64)) {
    return json(400, { message: "Invalid ots_b64" });
  }

  let bytes;
  try {
    bytes = Buffer.from(otsB64, "base64");
  } catch {
    return json(400, { message: "Invalid base64" });
  }

  try {
    const detached = OpenTimestamps.DetachedTimestampFile.deserialize(new Uint8Array(bytes));
    const before = Buffer.from(detached.serializeToBytes()).toString("base64");

    const changed = await OpenTimestamps.upgrade(detached, {});

    const afterBytes = detached.serializeToBytes();
    const after = Buffer.from(afterBytes).toString("base64");

    // Some upgrades may report changed=false but still round-trip; be conservative.
    const effectiveChanged = Boolean(changed) || before !== after;

    return json(200, {
      ots_b64: after,
      encoding: "base64",
      changed: effectiveChanged
    });
  } catch (err) {
    // Deserialization errors should be 400.
    const msg = err?.message || String(err);
    if (/deserialize|deserialization|magic|timestamp file|Invalid timestamp/i.test(msg)) {
      return json(400, { message: msg });
    }

    console.error(err);
    return json(500, { message: msg });
  }
};
