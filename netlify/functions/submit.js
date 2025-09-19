exports.handler = async (event) => {
    const body = JSON.parse(event.body);
    const lang = body.lang || "en";

    const messages = {
        en: "Your surrender has been recorded.",
        zh: "你的投降书已被记录。",
        ja: "あなたの降伏書は記録されました。"
    };

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: messages[lang] || messages["en"],
            filename: `${body.name}.json`
        })
    };
};
