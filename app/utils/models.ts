export type ModelValue = "sonnet" | "opus" | "haiku";

export type ModelOption = {
  value: ModelValue;
  label: string;
  emoji: string;
  modelId: string;
};

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    value: "opus",
    label: "Opus 4.5",
    emoji: "💎",
    modelId: "claude-opus-4-5-20251101"
  },
  {
    value: "sonnet",
    label: "Sonnet 4.5",
    emoji: "",
    modelId: "claude-sonnet-4-5-20250929"
  },
  {
    value: "haiku",
    label: "Haiku 4.5",
    emoji: "⚡",
    modelId: "claude-haiku-4-5-20251001"
  }
] as const;

export const DEFAULT_MODEL: ModelValue = "opus";

export function getModelEmoji(model: string | undefined): string {
  if (!model) return "";

  const option = MODEL_OPTIONS.find(opt =>
    model.includes(opt.value) || model.includes(opt.modelId)
  );

  return option?.emoji || "";
}
