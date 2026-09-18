import { registerAs } from "@nestjs/config";
import { Static, Type } from "@sinclair/typebox";
import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  AI_REVIEW_ADAPTER: Type.Union([
    Type.Literal("anthropic"),
    Type.Literal("mock"),
    Type.Literal("disabled"),
  ]),
  ANTHROPIC_API_KEY: Type.Optional(Type.String()),
  AI_REVIEW_MODEL: Type.String(),
  AI_REVIEW_EFFORT: Type.Union([
    Type.Literal("low"),
    Type.Literal("medium"),
    Type.Literal("high"),
    Type.Literal("xhigh"),
    Type.Literal("max"),
  ]),
  AI_REVIEW_MAX_INPUT_CHARS: Type.Integer({ minimum: 10_000 }),
  AI_REVIEW_MAX_BATCHES: Type.Integer({ minimum: 1, maximum: 20 }),
});

export type AiConfigSchema = Static<typeof schema>;

const validateAiConfig = configValidator(schema);

export default registerAs("ai", (): AiConfigSchema => {
  const values = {
    AI_REVIEW_ADAPTER: process.env.AI_REVIEW_ADAPTER ?? "mock",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    AI_REVIEW_MODEL: process.env.AI_REVIEW_MODEL ?? "claude-opus-5",
    AI_REVIEW_EFFORT: process.env.AI_REVIEW_EFFORT ?? "high",
    AI_REVIEW_MAX_INPUT_CHARS: parseInt(
      process.env.AI_REVIEW_MAX_INPUT_CHARS ?? "200000",
      10,
    ),
    AI_REVIEW_MAX_BATCHES: parseInt(
      process.env.AI_REVIEW_MAX_BATCHES ?? "3",
      10,
    ),
  };

  return validateAiConfig(values);
});
