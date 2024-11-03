export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
        const response = await fetch(url);
        const data = await response.text();

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", response.headers.get("content-type"));
        res.status(200).send(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch the requested URL" });
    }
}
