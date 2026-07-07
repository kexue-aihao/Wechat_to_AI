require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const { XMLParser } = require("fast-xml-parser");
const OpenAI = require("openai");

const app = express();
const port = Number(process.env.PORT || 3000);
const wechatToken = process.env.WECHAT_TOKEN;

const providerDefaults = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5",
  },
};

const requestedProvider = String(
  process.env.AI_PROVIDER ||
    (process.env.DEEPSEEK_API_KEY
      ? "deepseek"
      : process.env.OPENAI_API_KEY
      ? "openai"
      : "deepseek")
)
  .trim()
  .toLowerCase();

const aiProvider = providerDefaults[requestedProvider]
  ? requestedProvider
  : "deepseek";

const aiApiKey =
  process.env.AI_API_KEY ||
  (aiProvider === "deepseek"
    ? process.env.DEEPSEEK_API_KEY
    : process.env.OPENAI_API_KEY) ||
  process.env.OPENAI_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  "";

const aiBaseURL =
  process.env.AI_BASE_URL ||
  (aiProvider === "deepseek"
    ? process.env.DEEPSEEK_BASE_URL
    : process.env.OPENAI_BASE_URL) ||
  providerDefaults[aiProvider].baseURL;

const aiModel =
  process.env.AI_MODEL ||
  (aiProvider === "deepseek"
    ? process.env.DEEPSEEK_MODEL
    : process.env.OPENAI_MODEL) ||
  providerDefaults[aiProvider].model;

const replyFallbackText =
  process.env.AI_ERROR_REPLY || "AI 服务当前暂时不可用，请稍后再试。";

const deepseekThinking = String(process.env.DEEPSEEK_THINKING || "enabled")
  .trim()
  .toLowerCase();

const deepseekReasoningEffort = String(
  process.env.DEEPSEEK_REASONING_EFFORT || "high"
)
  .trim()
  .toLowerCase();

const logReasoningMeta =
  String(process.env.LOG_REASONING_META || "true").trim().toLowerCase() ===
  "true";

if (!wechatToken) {
  console.warn("[warn] WECHAT_TOKEN 未配置，微信验签将无法通过。");
}

if (!aiApiKey) {
  console.warn(
    `[warn] ${aiProvider.toUpperCase()} API Key 未配置，AI 调用会返回提示文案。`
  );
}

const client = aiApiKey
  ? new OpenAI({
      apiKey: aiApiKey,
      baseURL: aiBaseURL,
    })
  : null;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
  cdataPropName: "__cdata",
});

app.use(express.text({ type: "*/*" }));

function sha1(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function checkSignature(signature, timestamp, nonce) {
  if (!signature || !timestamp || !nonce || !wechatToken) {
    return false;
  }

  const raw = [wechatToken, timestamp, nonce].sort().join("");
  return sha1(raw) === signature;
}

function readTextField(field) {
  if (field == null) return "";
  if (typeof field === "object" && field.__cdata != null) {
    return String(field.__cdata);
  }
  return String(field);
}

function normalizeAssistantText(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item.text === "string") return item.text;
        if (item && typeof item.content === "string") return item.content;
        return "";
      })
      .join("\n")
      .trim();

    return text;
  }

  return "";
}

function buildReplyXml({ toUser, fromUser, content }) {
  const safeContent = String(content || "").replace(/]]>/g, "]] ]><![CDATA[>");

  return [
    "<xml>",
    `  <ToUserName><![CDATA[${toUser}]]></ToUserName>`,
    `  <FromUserName><![CDATA[${fromUser}]]></FromUserName>`,
    `  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    "  <MsgType><![CDATA[text]]></MsgType>",
    `  <Content><![CDATA[${safeContent}]]></Content>`,
    "</xml>",
  ].join("\n");
}

async function generateReply(userContent) {
  if (!client) {
    return `服务端还没有配置 ${aiProvider.toUpperCase()} API Key，请先在 .env 中完成配置。`;
  }

  const requestBody = {
    model: aiModel,
    messages: [
      {
        role: "system",
        content: "你是公众号智能助手，请用简洁、友好的中文回答用户。",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  };

  if (aiProvider === "deepseek") {
    requestBody.reasoning_effort = deepseekReasoningEffort;
    requestBody.extra_body = {
      thinking: {
        type: deepseekThinking,
      },
    };
  }

  const response = await client.chat.completions.create(requestBody);

  const reasoningContent =
    response.choices?.[0]?.message?.reasoning_content || "";

  if (aiProvider === "deepseek" && logReasoningMeta) {
    console.log("[deepseek-thinking]", {
      model: aiModel,
      thinking: deepseekThinking,
      reasoningEffort: deepseekReasoningEffort,
      hasReasoning: reasoningContent.length > 0,
      reasoningLength: reasoningContent.length,
    });
  }

  const replyText = normalizeAssistantText(
    response.choices?.[0]?.message?.content
  );

  return replyText || "我暂时不知道怎么回答这个问题。";
}

app.get("/", (_req, res) => {
  res.send("wechat-to-ai server is running");
});

app.get("/wechat", (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;

  if (!checkSignature(signature, timestamp, nonce)) {
    return res.status(401).send("invalid signature");
  }

  return res.send(echostr || "");
});

app.post("/wechat", async (req, res) => {
  const { signature, timestamp, nonce } = req.query;

  if (!checkSignature(signature, timestamp, nonce)) {
    return res.status(401).send("invalid signature");
  }

  let fromUser = "";
  let toUser = "";

  try {
    const parsed = xmlParser.parse(req.body || "");
    const msg = parsed.xml || {};

    fromUser = readTextField(msg.FromUserName);
    toUser = readTextField(msg.ToUserName);
    const msgType = readTextField(msg.MsgType);
    const content = readTextField(msg.Content);

    console.log("[wechat] incoming", {
      fromUser,
      toUser,
      msgType,
      content,
      msgId: readTextField(msg.MsgId),
      at: new Date().toISOString(),
    });

    if (msgType !== "text") {
      return res.send("success");
    }

    const replyText = await generateReply(content);
    const replyXml = buildReplyXml({
      toUser: fromUser,
      fromUser: toUser,
      content: replyText,
    });

    res.type("application/xml; charset=utf-8");
    return res.send(replyXml);
  } catch (error) {
    console.error("[wechat] handle message failed:", error);

    if (fromUser && toUser) {
      const replyXml = buildReplyXml({
        toUser: fromUser,
        fromUser: toUser,
        content: replyFallbackText,
      });

      res.type("application/xml; charset=utf-8");
      return res.send(replyXml);
    }

    return res.send("success");
  }
});

app.listen(port, () => {
  console.log(`[startup] server listening on http://localhost:${port}`);
  console.log("[startup] configure your WeChat callback path as /wechat");
  console.log(
    `[startup] AI provider=${aiProvider}, model=${aiModel}, baseURL=${aiBaseURL}`
  );

  if (aiProvider === "deepseek") {
    console.log(
      `[startup] DeepSeek thinking=${deepseekThinking}, reasoning_effort=${deepseekReasoningEffort}, log_reasoning_meta=${logReasoningMeta}`
    );
  }
});
