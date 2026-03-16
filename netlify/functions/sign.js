const OpenTimestamps = require("opentimestamps");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
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

  const filename = body.filename;
  const sha256 = body.sha256;

  if (typeof filename !== "string" || filename.length === 0) {
    return json(400, { message: "Invalid filename" });
  }
  if (!isHexSha256(sha256)) {
    return json(400, { message: "Invalid sha256 (expected 64 hex chars)" });
  }

  try {
    const digest = Buffer.from(sha256, "hex");
    const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      digest
    );

    await OpenTimestamps.stamp(detached);

    const otsBytes = detached.serializeToBytes();
    const otsB64 = Buffer.from(otsBytes).toString("base64");

    return json(200, {
      filename,
      sha256,
      ots_b64: otsB64,
      encoding: "base64"
    });
  } catch (err) {
    console.error(err);
    return json(500, { message: err?.message || String(err) });
  }
};
