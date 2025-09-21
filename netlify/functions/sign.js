const { Octokit } = require("@octokit/rest");
const OpenTimestamps = require("opentimestamps");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const body = JSON.parse(event.body);
    const filename = body.filename;
    const sha256 = body.sha256;

    let otsBytes;

    try {
        // OpenTimestamps 证明
        const digest = Buffer.from(sha256, "hex");
        const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
            new OpenTimestamps.Ops.OpSHA256(),
            digest
        );
        await OpenTimestamps.stamp(detached);
        otsBytes = detached.serializeToBytes();
    } catch (err) {
        console.error(err);
        return { statusCode: 400, body: JSON.stringify({ message: err.message }) };
    }

    try {
        const otsPath = `ots/${filename}.ots`;
        // 提交 OTS 文件
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path: otsPath,
            message: `add ots proof for ${sha256.slice(0, 10)}`,
            content: Buffer.from(otsBytes).toString('base64'), branch: BRANCH,
            committer: { name: 'Surrender Bot', email: 'no-reply@example.com' }
        });

        const ots_url = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${otsPath}`;
        return {
            statusCode: 200, body: JSON.stringify({ ots_url })
        };
    } catch (err) {
        console.error(err);
        // 上传错误时，将 OTS 文件返回给用户
        return { statusCode: 202, body: JSON.stringify({ message: err.message, otsFile: otsBytes.toString("base64") }) };
    }
};
