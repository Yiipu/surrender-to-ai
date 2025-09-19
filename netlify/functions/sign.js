const { Octokit } = require("@octokit/rest");
const OpenTimestamps = require("opentimestamps");
const crypto = require("crypto");
const Base64 = require("js-base64").Base64;

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const body = JSON.parse(event.body);
    const name = (body.name || '').slice(0, 200);
    const note = (body.note || '').slice(0, 2000);

    const record = {
        type: 'surrender-to-ai',
        name,
        note,
        timestamp: new Date().toISOString()
    };
    const content = JSON.stringify(record, null, 2);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const filename = `signatures/${record.timestamp.replace(/[:.]/g, '-')}-${sha256.slice(0, 10)}.json`;
    const b64 = Base64.encode(content);

    try {
        // 提交签名 JSON 文件
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path: filename,
            message: `add signature ${sha256.slice(0, 10)}`,
            content: b64, branch: BRANCH,
            committer: { name: 'Surrender Bot', email: 'no-reply@example.com' }
        });

        // OpenTimestamps 证明
        const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
            new OpenTimestamps.Ops.OpSHA256(),
            Buffer.from(content)
        );
        await OpenTimestamps.stamp(detached);
        const otsBytes = detached.serializeToBytes();

        // 提交 OTS 文件
        const otsPath = `ots/${sha256}.ots`;
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path: otsPath,
            message: `add ots proof for ${sha256.slice(0, 10)}`,
            content: Base64.encode(otsBytes.toString('binary')), branch: BRANCH,
            committer: { name: 'Surrender Bot', email: 'no-reply@example.com' }
        });

        const ots_url = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${otsPath}`;
        return { statusCode: 200, body: JSON.stringify({ path: filename, sha256, ots_url }) };

    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
    }
};
