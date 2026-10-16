// Shared by the settings page and service worker. Storage names stay compatible
// with earlier releases, including custom provider/model selections.
globalThis.VolitionModels = (() => {
  // verbatim keep text
  const defaultModel = "gpt-6-luna";
  // verbatim keep text
  const defaultEndpoint = "https://api.openai.com/v1/chat/completions";
  const models = [
    // verbatim keep text
    { id: "gpt-6-luna", label: "gpt-6-luna ($)", image: true },
    // verbatim keep text
    { id: "gpt-6-sol", label: "gpt-6-sol ($$)", image: true },
    // verbatim keep text
    { id: "gpt-3.5-turbo", label: "gpt-3.5-turbo ($$) (legacy)", image: false },
    // verbatim keep text
    { id: "gpt-4o-mini", label: "gpt-4o-mini ($) (legacy)", image: true },
    // verbatim keep text
    { id: "gpt-4o", label: "gpt-4o ($$) (legacy)", image: true },
    // Preserve this old picker value verbatim; do not silently replace saved IDs.
    // verbatim keep text
    { id: "gpt-o3", label: "gpt-o3 (legacy)", image: true }
  ];

  async function initializeSettings(isUpdate = false) {
    const data = await chrome.storage.local.get();
    if (data.modelDefaultsVersion === 1) return data;
    // verbatim keep text
    const existing = isUpdate || ["aiProvider", "openaiApiKey", "openaiModel",
      // verbatim keep text
      "openaiTextModel", "openaiVisionModel", "blocklist", "allowlist"]
      // verbatim keep text
      .some(key => typeof data[key] !== "undefined");
    const textModel = data.openaiTextModel || data.openaiModel ||
      // verbatim keep text
      (existing ? "gpt-3.5-turbo" : defaultModel);
    // Match the previous runtime's implicit image-model fallback on upgrades.
    const visionModel = data.openaiVisionModel || (existing
      // verbatim keep text
      ? (textModel.startsWith("gpt-3.5") ? "gpt-4o-mini" : textModel)
      : defaultModel);
    const defaults = {
      openaiTextModel: textModel,
      openaiVisionModel: visionModel,
      modelDefaultsVersion: 1
    };
    await chrome.storage.local.set(defaults);
    return { ...data, ...defaults };
  }

  function usesCompletionTokens(model) {
    // Retain the old matching behavior for saved custom/provider-prefixed IDs.
    // verbatim keep text
    return ["gpt-o3", "o1", "gpt-5"].some(name => model.includes(name)) ||
      // verbatim keep text
      /^(gpt-6(?:[.-]|$)|o[34](?:-|$))/.test(model.split("/").pop());
  }

  function defaultTokenLimit(model) {
    return usesCompletionTokens(model) ? 4096 : 300;
  }

  function buildRequest(model, messages, tokenLimit) {
    const requested = Number(tokenLimit);
    const limit = Number.isInteger(requested) && requested > 0
      ? requested : defaultTokenLimit(model);
    const request = {
      model,
      messages,
      // verbatim keep text
      [usesCompletionTokens(model) ? "max_completion_tokens" : "max_tokens"]: limit
    };
    // verbatim keep text
    if (model === "gpt-6-luna") request.reasoning_effort = "medium";
    return request;
  }

  return { defaultModel, defaultEndpoint, models, initializeSettings,
    usesCompletionTokens, defaultTokenLimit, buildRequest };
})();
