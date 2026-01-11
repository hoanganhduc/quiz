import { getTopicTitle } from "@app/shared";

export function formatTopicSummary(topics: string[], max = 6): string {
  if (!topics?.length) return "None";
  const friendly = topics.map((topic) => `${getTopicTitle(topic)} (${topic})`);
  if (friendly.length <= max) {
    return friendly.join(", ");
  }
  const extra = friendly.length - max;
  return `${friendly.slice(0, max).join(", ")} +${extra} more`;
}

export function topicListFriendly(topics: string[], max = 5): string {
  if (!topics?.length) return "";
  const friendly = topics.map((topic) => getTopicTitle(topic));
  if (friendly.length <= max) return friendly.join(", ");
  const extra = friendly.length - max;
  return `${friendly.slice(0, max).join(", ")} +${extra} more`;
}
