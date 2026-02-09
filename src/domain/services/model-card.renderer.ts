import type { ModelCard } from '../../shared/types/models.js';

const stars = (count: number): string => '★'.repeat(Math.max(0, Math.min(5, count)));

const averageScore = (card: ModelCard): number => {
  const values = Object.values(card.stars);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function renderModelCard(card: ModelCard): string {
  return [
    `🤖 ${card.title}`,
    `Provider: ${card.provider}`,
    `Model ID: ${card.modelId}`,
    `Power Tier: ${card.powerTier}`,
    `Overall: ${averageScore(card).toFixed(1)} / 5.0`,
    `Tags: ${card.tags.join(', ')}`,
    '',
    `💻 Coding:        ${stars(card.stars.coding)} (${card.stars.coding}/5)`,
    `🧠 Reasoning:     ${stars(card.stars.reasoning)} (${card.stars.reasoning}/5)`,
    `🌐 Multilingual:  ${stars(card.stars.multilingual)} (${card.stars.multilingual}/5)`,
    `⚡ Speed:         ${stars(card.stars.speed)} (${card.stars.speed}/5)`,
    `🛡️ Safety:        ${stars(card.stars.safety)} (${card.stars.safety}/5)`,
  ].join('\n');
}
